/**
 * Production/local smoke: konsignatsiya limiti — to‘lov → qarz ↓ → limit qaytishi.
 * Ishlatish: `npx tsx scripts/smoke-consignment-limit-restore.ts`
 * Railway: `npx @railway/cli run --service backend npx tsx scripts/smoke-consignment-limit-restore.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import {
  computeAgentConsignmentOutstanding,
  utcMonthStart
} from "../src/modules/consignment/consignment.service";

const TAG = `[smoke-consign-limit-${Date.now()}]`;

function fail(msg: string): never {
  console.error("FAIL:", msg);
  throw new Error(msg);
}

function assertEq(actual: string, expected: string, label: string) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`);
  console.log("OK:", label, "=", actual);
}

async function main() {
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: "test1" } })) ??
    (await prisma.tenant.findFirst({ orderBy: { id: "asc" } }));
  if (!tenant) fail("tenant topilmadi");

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true, consignment: true }
  });
  if (!agent) fail("consignment agent topilmadi");

  const client = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, is_active: true, merged_into_client_id: null }
  });
  if (!client) fail("client topilmadi");

  const monthStartsAt = utcMonthStart(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1);
  const opts = { ignorePreviousMonthsDebt: false, monthStartsAt };
  const orderIds: number[] = [];
  const paymentIds: number[] = [];

  try {
    console.log("tenant", tenant.id, "agent", agent.id, "client", client.id);

    const mkOrder = async (total: number, status: string, suffix: string) => {
      const o = await prisma.order.create({
        data: {
          tenant_id: tenant.id,
          number: `${TAG}-${suffix}`,
          client_id: client.id,
          agent_id: agent.id,
          order_type: "order",
          status,
          is_consignment: true,
          total_sum: new Prisma.Decimal(total)
        }
      });
      orderIds.push(o.id);
      return o;
    };

    const deltaFor = async (orderId: number) => {
      const withO = await computeAgentConsignmentOutstanding(prisma, tenant.id, agent.id, opts);
      const without = await computeAgentConsignmentOutstanding(prisma, tenant.id, agent.id, {
        ...opts,
        excludeOrderId: orderId
      });
      return withO.sub(without).toString();
    };

    // 1) new order bands
    const oNew = await mkOrder(100_000, "new", "new");
    assertEq(await deltaFor(oNew.id), "100000", "new order bands");

    // 2) cancelled free
    const oCancel = await mkOrder(80_000, "cancelled", "cancel");
    assertEq(await deltaFor(oCancel.id), "0", "cancelled free");

    // 3) payment restores
    const oPay = await mkOrder(200_000, "delivered", "pay");
    assertEq(await deltaFor(oPay.id), "200000", "unpaid before pay");
    const pay = await prisma.payment.create({
      data: {
        tenant_id: tenant.id,
        client_id: client.id,
        order_id: null,
        amount: new Prisma.Decimal(200_000),
        payment_type: "cash_uzs",
        note: `${TAG} full`,
        workflow_status: "confirmed",
        entry_kind: "payment",
        confirmed_at: new Date()
      }
    });
    paymentIds.push(pay.id);
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenant.id,
        payment_id: pay.id,
        order_id: oPay.id,
        amount: new Prisma.Decimal(200_000)
      }
    });
    assertEq(await deltaFor(oPay.id), "0", "after pay outstanding 0 (limit returned)");

    // 4) pending does not free
    const oPend = await mkOrder(70_000, "new", "pend");
    const pend = await prisma.payment.create({
      data: {
        tenant_id: tenant.id,
        client_id: client.id,
        amount: new Prisma.Decimal(70_000),
        payment_type: "cash_uzs",
        note: `${TAG} pending`,
        workflow_status: "pending_confirmation",
        entry_kind: "payment"
      }
    });
    paymentIds.push(pend.id);
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenant.id,
        payment_id: pend.id,
        order_id: oPend.id,
        amount: new Prisma.Decimal(70_000)
      }
    });
    assertEq(await deltaFor(oPend.id), "70000", "pending does not free");

    console.log("\nALL SMOKE CHECKS PASSED");
  } finally {
    if (paymentIds.length) {
      await prisma.paymentAllocation.deleteMany({
        where: { tenant_id: tenant.id, payment_id: { in: paymentIds } }
      });
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
    }
    if (orderIds.length) {
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
