import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import {
  computeAgentConsignmentOutstanding,
  utcMonthStart
} from "../src/modules/consignment/consignment.service";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const TAG = `[vitest-consign-out-${process.env.VITEST_TEST_RUN_ID ?? "local"}]`;

function monthOpts(ignorePreviousMonthsDebt = false) {
  const now = new Date();
  return {
    ignorePreviousMonthsDebt,
    monthStartsAt: utcMonthStart(now.getUTCFullYear(), now.getUTCMonth() + 1)
  };
}

describe.skipIf(!dbReady)("consignment outstanding (limit restore)", () => {
  let tenantId = 0;
  let agentId = 0;
  let clientId = 0;
  const orderIds: number[] = [];
  const paymentIds: number[] = [];

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    tenantId = tenant!.id;

    const agent = await prisma.user.findFirst({
      where: { tenant_id: tenantId, login: "agent", role: "agent", is_active: true }
    });
    expect(agent).toBeTruthy();
    agentId = agent!.id;

    const client = await prisma.client.findFirst({
      where: { tenant_id: tenantId, is_active: true, merged_into_client_id: null }
    });
    expect(client).toBeTruthy();
    clientId = client!.id;
  });

  afterAll(async () => {
    if (paymentIds.length > 0) {
      await prisma.paymentAllocation.deleteMany({
        where: { tenant_id: tenantId, payment_id: { in: paymentIds } }
      });
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
    }
    if (orderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
  });

  async function createOrder(opts: {
    total: number;
    status?: string;
    createdAt?: Date;
    suffix: string;
  }) {
    const number = `${TAG}-O-${opts.suffix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        number,
        client_id: clientId,
        agent_id: agentId,
        order_type: "order",
        status: opts.status ?? "new",
        is_consignment: true,
        total_sum: new Prisma.Decimal(opts.total),
        created_at: opts.createdAt ?? new Date()
      }
    });
    orderIds.push(order.id);
    return order;
  }

  async function createPayment(opts: {
    amount: number;
    orderId?: number | null;
    workflow_status?: string;
    entry_kind?: string;
    deleted_at?: Date | null;
    note: string;
  }) {
    const payment = await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: clientId,
        order_id: opts.orderId ?? null,
        amount: new Prisma.Decimal(opts.amount),
        payment_type: "cash_uzs",
        note: `${TAG} ${opts.note}`,
        workflow_status: opts.workflow_status ?? "confirmed",
        entry_kind: opts.entry_kind ?? "payment",
        deleted_at: opts.deleted_at ?? null,
        confirmed_at: opts.workflow_status === "pending_confirmation" ? null : new Date()
      }
    });
    paymentIds.push(payment.id);
    return payment;
  }

  it("new consignment order bands limit (outstanding = total)", async () => {
    const o = await createOrder({ total: 100_000, status: "new", suffix: "new" });
    const outstanding = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: undefined
    });
    // Agentda boshqa test/seed konsignatsiya bo‘lishi mumkin — shu zakazni alohida tekshiramiz
    const alone = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    expect(outstanding.sub(alone).toString()).toBe("100000");
  });

  it("cancelled / returned free the limit", async () => {
    const cancelled = await createOrder({ total: 80_000, status: "cancelled", suffix: "cancel" });
    const returned = await createOrder({ total: 90_000, status: "returned", suffix: "ret" });
    const before = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const without = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: cancelled.id
    });
    expect(before.toString()).toBe(without.toString());
    const withoutRet = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: returned.id
    });
    expect(before.toString()).toBe(withoutRet.toString());
  });

  it("confirmed allocation payment reduces outstanding (limit returns)", async () => {
    const o = await createOrder({ total: 200_000, status: "delivered", suffix: "alloc-pay" });
    const beforeAlone = new Prisma.Decimal(200_000);

    const pay = await createPayment({
      amount: 200_000,
      orderId: null,
      note: "alloc-full"
    });
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenantId,
        payment_id: pay.id,
        order_id: o.id,
        amount: new Prisma.Decimal(200_000)
      }
    });

    const withOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const withoutOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    // To‘liq to‘langan — band summaga qo‘shilmasligi kerak
    expect(withOrder.sub(withoutOrder).toString()).toBe("0");
    expect(beforeAlone.toString()).toBe("200000");
  });

  it("partial payment frees partial remaining limit", async () => {
    const o = await createOrder({ total: 150_000, status: "delivering", suffix: "partial" });
    const pay = await createPayment({
      amount: 50_000,
      orderId: null,
      note: "alloc-partial"
    });
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenantId,
        payment_id: pay.id,
        order_id: o.id,
        amount: new Prisma.Decimal(50_000)
      }
    });

    const withOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const withoutOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    expect(withOrder.sub(withoutOrder).toString()).toBe("100000");
  });

  it("direct order_id payment reduces outstanding", async () => {
    const o = await createOrder({ total: 120_000, status: "confirmed", suffix: "direct" });
    await createPayment({
      amount: 120_000,
      orderId: o.id,
      note: "direct-full"
    });

    const withOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const withoutOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    expect(withOrder.sub(withoutOrder).toString()).toBe("0");
  });

  it("pending / void payments do NOT free limit", async () => {
    const oPending = await createOrder({ total: 70_000, status: "new", suffix: "pend" });
    const payPending = await createPayment({
      amount: 70_000,
      orderId: null,
      workflow_status: "pending_confirmation",
      note: "pending"
    });
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenantId,
        payment_id: payPending.id,
        order_id: oPending.id,
        amount: new Prisma.Decimal(70_000)
      }
    });

    const oVoid = await createOrder({ total: 60_000, status: "new", suffix: "void" });
    const payVoid = await createPayment({
      amount: 60_000,
      orderId: oVoid.id,
      deleted_at: new Date(),
      note: "voided"
    });
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenantId,
        payment_id: payVoid.id,
        order_id: oVoid.id,
        amount: new Prisma.Decimal(60_000)
      }
    });

    const withPend = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const withoutPend = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: oPending.id
    });
    expect(withPend.sub(withoutPend).toString()).toBe("70000");

    const withVoid = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const withoutVoid = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: oVoid.id
    });
    expect(withVoid.sub(withoutVoid).toString()).toBe("60000");
  });

  it("discount_settlement also frees limit", async () => {
    const o = await createOrder({ total: 40_000, status: "delivered", suffix: "disc" });
    await createPayment({
      amount: 40_000,
      orderId: o.id,
      entry_kind: "discount_settlement",
      note: "discount"
    });
    const withOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const withoutOrder = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    expect(withOrder.sub(withoutOrder).toString()).toBe("0");
  });

  it("ignorePreviousMonthsDebt skips older unpaid orders", async () => {
    const old = await createOrder({
      total: 55_000,
      status: "new",
      suffix: "old-month",
      createdAt: new Date(Date.UTC(2020, 0, 15))
    });
    const all = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts(false));
    const ignored = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts(true));
    const allWithout = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(false),
      excludeOrderId: old.id
    });
    const ignoredWithout = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(true),
      excludeOrderId: old.id
    });
    expect(all.sub(allWithout).toString()).toBe("55000");
    expect(ignored.sub(ignoredWithout).toString()).toBe("0");
  });

  it("remaining limit formula: limit - outstanding after pay", async () => {
    const limit = new Prisma.Decimal(1_000_000);
    const o = await createOrder({ total: 300_000, status: "picking", suffix: "remain" });

    const outstandingBefore = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: undefined
    });
    const aloneBefore = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    expect(outstandingBefore.sub(aloneBefore).toString()).toBe("300000");

    const pay = await createPayment({
      amount: 300_000,
      orderId: null,
      note: "remain-pay"
    });
    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenantId,
        payment_id: pay.id,
        order_id: o.id,
        amount: new Prisma.Decimal(300_000)
      }
    });

    const outstandingAfter = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, monthOpts());
    const aloneAfter = await computeAgentConsignmentOutstanding(prisma, tenantId, agentId, {
      ...monthOpts(),
      excludeOrderId: o.id
    });
    expect(outstandingAfter.sub(aloneAfter).toString()).toBe("0");

    const remainingAfterPay = Prisma.Decimal.max(0, limit.sub(outstandingAfter));
    const remainingIfUnpaid = Prisma.Decimal.max(0, limit.sub(aloneAfter.add(300_000)));
    expect(remainingAfterPay.gte(remainingIfUnpaid)).toBe(true);
    expect(remainingAfterPay.sub(remainingIfUnpaid).toString()).toBe("300000");
  });
});
