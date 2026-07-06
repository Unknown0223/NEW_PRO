/**
 * `pending_confirmation` → confirm / reject servislari smoke test.
 *   npx tsx scripts/test-expeditor-pending-payments-once.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  confirmPendingPayment,
  rejectPendingPayment
} from "../src/modules/payments/payment.balance";

async function main() {
  const p = new PrismaClient();
  const tenant = await p.tenant.findUnique({ where: { slug: "test1" } });
  if (!tenant) {
    console.error("tenant test1 not found");
    process.exit(1);
  }

  const order = await p.order.findFirst({
    where: {
      tenant_id: tenant.id,
      order_type: "order",
      status: { not: "cancelled" },
      expeditor_user_id: { not: null }
    },
    orderBy: { id: "desc" },
    select: { id: true, client_id: true, agent_id: true, expeditor_user_id: true }
  });
  if (!order?.expeditor_user_id) {
    console.error("no expeditor order");
    process.exit(1);
  }

  const admin = await p.user.findFirst({
    where: { tenant_id: tenant.id, login: "admin", is_active: true },
    select: { id: true }
  });
  if (!admin) {
    console.error("admin not found");
    process.exit(1);
  }

  const balBefore = await p.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenant.id, client_id: order.client_id } },
    select: { balance: true }
  });
  const balanceBefore = Number(balBefore?.balance ?? 0);

  const rejectRow = await p.payment.create({
    data: {
      tenant_id: tenant.id,
      client_id: order.client_id,
      order_id: order.id,
      amount: new Prisma.Decimal(100_000),
      payment_type: "naqd",
      note: "[test] reject flow",
      created_by_user_id: order.expeditor_user_id,
      workflow_status: "pending_confirmation",
      received_at: new Date(),
      entry_kind: "payment",
      expeditor_user_id: order.expeditor_user_id,
      ledger_agent_id: order.agent_id
    },
    select: { id: true }
  });

  await rejectPendingPayment(tenant.id, rejectRow.id, admin.id, "test reject");
  const rejected = await p.payment.findUnique({
    where: { id: rejectRow.id },
    select: { workflow_status: true }
  });
  if (rejected?.workflow_status !== "rejected") {
    throw new Error(`reject failed: ${rejected?.workflow_status}`);
  }
  console.log("reject OK:", rejectRow.id);

  const confirmRow = await p.payment.create({
    data: {
      tenant_id: tenant.id,
      client_id: order.client_id,
      order_id: order.id,
      amount: new Prisma.Decimal(200_000),
      payment_type: "terminal",
      note: "[test] confirm flow",
      created_by_user_id: order.expeditor_user_id,
      workflow_status: "pending_confirmation",
      received_at: new Date(),
      entry_kind: "payment",
      expeditor_user_id: order.expeditor_user_id,
      ledger_agent_id: order.agent_id
    },
    select: { id: true }
  });

  await confirmPendingPayment(tenant.id, confirmRow.id, admin.id);
  const confirmed = await p.payment.findUnique({
    where: { id: confirmRow.id },
    select: { workflow_status: true, confirmed_at: true }
  });
  if (confirmed?.workflow_status !== "confirmed" || !confirmed.confirmed_at) {
    throw new Error(`confirm failed: ${confirmed?.workflow_status}`);
  }

  const balAfter = await p.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenant.id, client_id: order.client_id } },
    select: { balance: true }
  });
  const balanceAfter = Number(balAfter?.balance ?? 0);
  if (Math.abs(balanceAfter - balanceBefore - 200_000) > 0.01) {
    throw new Error(`balance mismatch: before=${balanceBefore} after=${balanceAfter}`);
  }

  console.log("confirm OK:", confirmRow.id, "balance delta +200000");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
