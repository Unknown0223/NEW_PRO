/**
 * Real DB simulyatsiya: Work Slot + legacy/current debt + FIFO legacy_first + avto-arxiv.
 *
 *   cd backend && npx tsx scripts/sim-legacy-debt-work-slot.ts
 *   npx tsx scripts/sim-legacy-debt-work-slot.ts --keep
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { splitClientDeliveryDebt } from "../src/modules/client-balances/client-debt-by-agent";
import { allocatePayment } from "../src/modules/payments/payment-allocations.allocate";
import { maybeArchiveAgentsIfDebtCleared } from "../src/modules/work-slots/work-slots.archive-agent";

const prisma = new PrismaClient();
const KEEP = process.argv.includes("--keep");
const SLUG = process.env.AUDIT_TENANT_SLUG ?? "test1";
const PREFIX = `sim_legacy_${Date.now()}`;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main(): Promise<void> {
  console.log("=== SIM: legacy/current debt + work slot ===\n");

  const tenant = await prisma.tenant.findFirst({
    where: { slug: SLUG },
    select: { id: true }
  });
  assert(Boolean(tenant), `tenant ${SLUG} yo‘q`);
  const tenantId = tenant!.id;

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId },
    select: { id: true }
  });
  assert(Boolean(warehouse), "warehouse yo‘q");
  const warehouseId = warehouse!.id;

  const hash =
    (
      await prisma.user.findFirst({
        where: { tenant_id: tenantId },
        select: { password_hash: true }
      })
    )?.password_hash ?? "sim_hash";

  const davron = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: "Davron (Sim Eski)",
      login: `${PREFIX}_davron`,
      password_hash: hash,
      role: "agent",
      is_active: true
    }
  });
  const sardor = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: "Sardor (Sim Yangi)",
      login: `${PREFIX}_sardor`,
      password_hash: hash,
      role: "agent",
      is_active: true
    }
  });
  console.log(`[ok] agents davron=${davron.id} sardor=${sardor.id}`);

  const slot = await prisma.workSlot.create({
    data: {
      tenant_id: tenantId,
      slot_code: `SLOT-SIM-${Date.now()}`.slice(0, 32),
      label: "Sim Chilonzor",
      slot_type: "agent",
      is_active: true
    }
  });
  const link1 = await prisma.slotUserLink.create({
    data: {
      tenant_id: tenantId,
      slot_id: slot.id,
      user_id: davron.id,
      started_at: new Date()
    }
  });
  console.log(`[ok] slot ${slot.slot_code} → Davron`);

  const client = await prisma.client.create({
    data: {
      tenant_id: tenantId,
      name: `Oazis Sim ${PREFIX}`,
      address: "Chilonzor",
      is_active: true,
      agent_id: davron.id
    }
  });
  await prisma.clientBalance.create({
    data: { tenant_id: tenantId, client_id: client.id, balance: 0 }
  });
  console.log(`[ok] client ${client.id}`);

  const order1 = await prisma.order.create({
    data: {
      tenant_id: tenantId,
      number: `${PREFIX}-1`,
      client_id: client.id,
      warehouse_id: warehouseId,
      agent_id: davron.id,
      order_type: "order",
      status: "delivered",
      total_sum: new Prisma.Decimal(4_000_000),
      discount_sum: new Prisma.Decimal(0),
      bonus_sum: new Prisma.Decimal(0)
    }
  });
  console.log(`[ok] Davron order #${order1.number} 4_000_000 delivered`);

  await prisma.slotUserLink.update({
    where: { id: link1.id },
    data: { ended_at: new Date() }
  });
  await prisma.slotUserLink.create({
    data: {
      tenant_id: tenantId,
      slot_id: slot.id,
      user_id: sardor.id,
      started_at: new Date()
    }
  });
  await prisma.client.update({
    where: { id: client.id },
    data: { agent_id: sardor.id }
  });
  console.log(`[ok] shift: Davron off, Sardor on; client.agent_id → Sardor`);

  const order2 = await prisma.order.create({
    data: {
      tenant_id: tenantId,
      number: `${PREFIX}-2`,
      client_id: client.id,
      warehouse_id: warehouseId,
      agent_id: sardor.id,
      order_type: "order",
      status: "delivered",
      total_sum: new Prisma.Decimal(2_000_000),
      discount_sum: new Prisma.Decimal(0),
      bonus_sum: new Prisma.Decimal(0)
    }
  });
  console.log(`[ok] Sardor order #${order2.number} 2_000_000 delivered`);

  const split1 = await splitClientDeliveryDebt(tenantId, client.id, sardor.id);
  console.log(
    `\n[check] split: legacy=${split1.legacy_debt} current=${split1.current_debt} total=${split1.total_debt}`
  );
  assert(Number(split1.legacy_debt) === 4_000_000, "legacy 4M");
  assert(Number(split1.current_debt) === 2_000_000, "current 2M");
  console.log("[PASS] Tekshiruv 1 — 4M legacy / 2M current");

  const pay = await prisma.payment.create({
    data: {
      tenant_id: tenantId,
      client_id: client.id,
      amount: new Prisma.Decimal(5_000_000),
      payment_type: "cash",
      ledger_agent_id: sardor.id,
      created_by_user_id: sardor.id,
      paid_at: new Date(),
      received_at: new Date()
    }
  });
  await allocatePayment(tenantId, pay.id, sardor.id, {
    mode: "none",
    agent_id: null,
    priority: "legacy_first",
    current_agent_id: sardor.id
  });
  console.log(`[ok] payment ${pay.id} 5_000_000 allocated legacy_first`);

  const split2 = await splitClientDeliveryDebt(tenantId, client.id, sardor.id);
  console.log(
    `\n[check] after pay: legacy=${split2.legacy_debt} current=${split2.current_debt}`
  );
  assert(Number(split2.legacy_debt) === 0, "legacy 0 after FIFO");
  assert(Number(split2.current_debt) === 1_000_000, "current 1M after FIFO");
  console.log("[PASS] Tekshiruv 2 — FIFO 5M → legacy 0, current 1M");

  const archived = await maybeArchiveAgentsIfDebtCleared(
    tenantId,
    [davron.id],
    sardor.id
  );
  const davronAfter = await prisma.user.findUnique({
    where: { id: davron.id },
    select: { is_active: true }
  });
  console.log(`[check] archive touched=${archived.join(",")} davron.active=${davronAfter?.is_active}`);
  assert(davronAfter?.is_active === false, "Davron avto-arxivlanishi kerak");
  console.log("[PASS] Davron is_active=false");

  if (!KEEP) {
    await prisma.paymentAllocation.deleteMany({ where: { payment_id: pay.id } });
    await prisma.payment.delete({ where: { id: pay.id } });
    await prisma.order.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
    await prisma.clientBalance.deleteMany({ where: { client_id: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.slotUserLink.deleteMany({ where: { slot_id: slot.id } });
    await prisma.slotAuditEntry.deleteMany({ where: { slot_id: slot.id } }).catch(() => undefined);
    await prisma.workSlot.delete({ where: { id: slot.id } });
    await prisma.user.deleteMany({ where: { id: { in: [davron.id, sardor.id] } } });
    console.log("\n[cleanup] sim rows removed (use --keep to retain)");
  } else {
    console.log("\n[--keep] sim rows retained");
  }

  console.log("\n=== SIM DONE — ALL CHECKS PASSED ===");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
