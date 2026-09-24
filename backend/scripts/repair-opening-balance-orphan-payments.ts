/**
 * Repair soft-voided opening balances whose ledger payment is still active.
 * DRY_RUN=1 — report only.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

function noteMatchesEntry(note: string | null | undefined, entryId: number): boolean {
  if (!note) return false;
  return new RegExp(`начальный баланс #${entryId}(?!\\d)`, "i").test(note);
}

async function softVoidPaymentOnly(paymentId: number, reason: string) {
  const now = new Date();
  await p.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId } });
    if (!payment || payment.deleted_at != null) return;

    const allocs = await tx.paymentAllocation.findMany({
      where: { payment_id: paymentId },
      select: { order_id: true, amount: true, created_at: true }
    });
    const snapshot = allocs.map((a) => ({
      order_id: a.order_id,
      amount: a.amount.toString(),
      created_at: a.created_at?.toISOString()
    }));

    await tx.paymentAllocation.deleteMany({ where: { payment_id: paymentId } });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        deleted_at: now,
        delete_reason_ref: reason.slice(0, 128),
        allocations_snapshot: snapshot.length ? snapshot : undefined
      }
    });
  });
}

async function voidPaymentWithLedgerReverse(paymentId: number, tenantId: number, reason: string) {
  // Dynamic import after DATABASE_URL is set — uses full deletePayment.
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  const { deletePayment } = await import("../src/modules/payments/payment.balance.void");
  await deletePayment(tenantId, paymentId, null, reason);
}

async function main() {
  const voided = await p.clientOpeningBalanceEntry.findMany({
    where: { deleted_at: { not: null } },
    select: {
      id: true,
      tenant_id: true,
      client_id: true,
      payment_id: true,
      amount: true,
      balance_type: true
    },
    orderBy: { id: "asc" }
  });

  const orphans: Array<{
    entryId: number;
    tenantId: number;
    paymentId: number;
    clientId: number;
    amount: string;
    type: string;
    legacyReversed: boolean;
  }> = [];

  for (const e of voided) {
    let paymentId = e.payment_id;
    if (paymentId == null) {
      const needle = `начальный баланс #${e.id}`;
      const cands = await p.payment.findMany({
        where: {
          tenant_id: e.tenant_id,
          client_id: e.client_id,
          deleted_at: null,
          note: { contains: needle, mode: "insensitive" }
        },
        select: { id: true, note: true },
        take: 20
      });
      paymentId = cands.find((c) => noteMatchesEntry(c.note, e.id))?.id ?? null;
    } else {
      const pay = await p.payment.findFirst({
        where: { id: paymentId, deleted_at: null },
        select: { id: true }
      });
      if (!pay) continue;
    }

    if (paymentId == null) continue;

    const active = await p.payment.findFirst({
      where: { id: paymentId, deleted_at: null },
      select: { id: true }
    });
    if (!active) continue;

    const legacyMove = await p.clientBalanceMovement.findFirst({
      where: { note: { contains: `Начальный баланс #${e.id} в архив` } },
      select: { id: true }
    });

    orphans.push({
      entryId: e.id,
      tenantId: e.tenant_id,
      paymentId,
      clientId: e.client_id,
      amount: String(e.amount),
      type: e.balance_type,
      legacyReversed: legacyMove != null
    });
  }

  console.log("ORPHANS", orphans.length);
  for (const o of orphans.slice(0, 50)) console.log(o);
  if (orphans.length > 50) console.log(`... +${orphans.length - 50} more`);

  if (DRY) {
    console.log("DRY_RUN — no writes");
    return;
  }

  let fixed = 0;
  for (const o of orphans) {
    const reason = `repair: opening balance #${o.entryId}`;
    if (o.legacyReversed) {
      await softVoidPaymentOnly(o.paymentId, reason);
    } else {
      await voidPaymentWithLedgerReverse(o.paymentId, o.tenantId, reason);
    }
    await p.clientOpeningBalanceEntry.update({
      where: { id: o.entryId },
      data: { payment_id: o.paymentId }
    });
    fixed++;
    console.log("FIXED", o.entryId, o.paymentId, o.legacyReversed ? "payment-only" : "full-void");
  }
  console.log({ fixed });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
