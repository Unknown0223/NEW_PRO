/**
 * Posted sales_returns with refund_amount>0 but no ledger client_payments(refund) row.
 * Creates payment rows only (skipBalance) — ClientBalance already updated on accept.
 *
 * Usage:
 *   npx tsx scripts/backfill-return-refund-payments.ts --tenant=test1 [--dry-run] [--client-id=123]
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { applyClientReturnRefund, returnRefundNote } from "../src/modules/returns/returns-enhanced.refund-ledger";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const tenantSlug = arg("tenant") ?? "test1";
  const dryRun = hasFlag("dry-run");
  const clientIdFilter = arg("client-id");
  const clientId = clientIdFilter ? Number(clientIdFilter) : null;

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug },
    select: { id: true, slug: true }
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const returns = await prisma.salesReturn.findMany({
    where: {
      tenant_id: tenant.id,
      status: "posted",
      client_id: clientId != null && Number.isFinite(clientId) ? clientId : { not: null },
      refund_amount: { gt: 0 }
    },
    select: {
      id: true,
      number: true,
      client_id: true,
      order_id: true,
      refund_amount: true,
      accepted_at: true,
      accepted_by_user_id: true,
      created_by_user_id: true,
      order: { select: { agent_id: true } }
    },
    orderBy: { id: "asc" }
  });

  let created = 0;
  let skipped = 0;
  for (const ret of returns) {
    if (ret.client_id == null) {
      skipped += 1;
      continue;
    }
    const note = returnRefundNote(ret.number);
    const existing = await prisma.payment.findFirst({
      where: {
        tenant_id: tenant.id,
        client_id: ret.client_id,
        deleted_at: null,
        OR: [
          { entry_kind: "refund", note },
          { entry_kind: "refund", note: `Vazvrat: ${ret.number}` },
          { note: `Vazvrat: ${ret.number}` },
          { note }
        ]
      },
      select: { id: true }
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const amount = new Prisma.Decimal(ret.refund_amount ?? 0);
    console.log(
      `${dryRun ? "[dry] " : ""}return ${ret.number} (#${ret.id}) client=${ret.client_id} refund=${amount.toString()}`
    );
    if (dryRun) {
      created += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await applyClientReturnRefund(tx, tenant.id, ret.client_id!, amount, ret.accepted_by_user_id ?? ret.created_by_user_id, {
        returnNumber: ret.number,
        orderId: ret.order_id,
        ledgerAgentId: ret.order?.agent_id ?? null,
        paidAt: ret.accepted_at ?? new Date(),
        skipBalance: true
      });
    });
    created += 1;
  }

  console.log(`Done. created=${created} skipped=${skipped} total=${returns.length} dry=${dryRun}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
