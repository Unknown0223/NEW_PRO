import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeAgentConsignmentOutstanding } from "../src/modules/consignment/consignment.service";

type FakeOrder = { id: number; total_sum: Prisma.Decimal; created_at: Date };
type FakeAlloc = { order_id: number; payment_id: number; amount: Prisma.Decimal };
type FakePay = {
  id: number;
  order_id: number | null;
  amount: Prisma.Decimal;
  workflow_status: string;
  entry_kind: string;
  deleted_at: Date | null;
};

function dec(n: number | string) {
  return new Prisma.Decimal(n);
}

function fakeDb(state: { orders: FakeOrder[]; allocs: FakeAlloc[]; payments: FakePay[] }) {
  return {
    order: {
      findMany: async (args: {
        where: {
          agent_id: number;
          status: { in: string[] };
          id?: { not: number };
        };
      }) => {
        const rows = state.orders.filter((o) => {
          const status = (o as FakeOrder & { status: string }).status;
          if (!args.where.status.in.includes(status)) return false;
          if (args.where.id?.not != null && o.id === args.where.id.not) return false;
          return true;
        });
        return rows.map((o) => ({
          id: o.id,
          total_sum: o.total_sum,
          created_at: o.created_at
        }));
      }
    },
    paymentAllocation: {
      findMany: async (args: { where: { order_id: { in: number[] } } }) =>
        state.allocs.filter((a) => args.where.order_id.in.includes(a.order_id))
    },
    payment: {
      findMany: async (args: {
        where: {
          id: { in: number[] };
          deleted_at: null;
          workflow_status: string;
          entry_kind: { in: string[] };
        };
      }) =>
        state.payments.filter(
          (p) =>
            args.where.id.in.includes(p.id) &&
            p.deleted_at == null &&
            p.workflow_status === args.where.workflow_status &&
            args.where.entry_kind.in.includes(p.entry_kind)
        ),
      groupBy: async (args: {
        where: {
          order_id: { in: number[] };
          entry_kind: { in: string[] };
          workflow_status: string;
          deleted_at: null;
        };
        _sum: { amount: true };
      }) => {
        const map = new Map<number, Prisma.Decimal>();
        for (const p of state.payments) {
          if (p.order_id == null) continue;
          if (!args.where.order_id.in.includes(p.order_id)) continue;
          if (p.deleted_at != null) continue;
          if (p.workflow_status !== args.where.workflow_status) continue;
          if (!args.where.entry_kind.in.includes(p.entry_kind)) continue;
          map.set(p.order_id, (map.get(p.order_id) ?? dec(0)).add(p.amount));
        }
        return [...map.entries()].map(([order_id, amount]) => ({
          order_id,
          _sum: { amount }
        }));
      }
    }
  };
}

function order(
  id: number,
  total: number,
  status: string,
  createdAt = new Date("2026-08-01T00:00:00Z")
): FakeOrder & { status: string } {
  return {
    id,
    total_sum: dec(total),
    created_at: createdAt,
    status
  };
}

describe("computeAgentConsignmentOutstanding (pure fake db)", () => {
  const monthStartsAt = new Date("2026-08-01T00:00:00Z");
  const baseOpts = { ignorePreviousMonthsDebt: false, monthStartsAt };

  it("bands unpaid new…delivered orders", async () => {
    const db = fakeDb({
      orders: [
        order(1, 100_000, "new"),
        order(2, 50_000, "delivering"),
        order(3, 80_000, "cancelled"),
        order(4, 90_000, "returned")
      ],
      allocs: [],
      payments: []
    });
    const out = await computeAgentConsignmentOutstanding(
      db as never,
      1,
      10,
      baseOpts
    );
    expect(out.toString()).toBe("150000");
  });

  it("allocation confirmed payment frees limit fully", async () => {
    const db = fakeDb({
      orders: [order(1, 200_000, "delivered")],
      allocs: [{ order_id: 1, payment_id: 9, amount: dec(200_000) }],
      payments: [
        {
          id: 9,
          order_id: null,
          amount: dec(200_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: null
        }
      ]
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, baseOpts);
    expect(out.toString()).toBe("0");
  });

  it("partial allocation frees partial remaining", async () => {
    const db = fakeDb({
      orders: [order(1, 150_000, "new")],
      allocs: [{ order_id: 1, payment_id: 9, amount: dec(50_000) }],
      payments: [
        {
          id: 9,
          order_id: null,
          amount: dec(50_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: null
        }
      ]
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, baseOpts);
    expect(out.toString()).toBe("100000");
  });

  it("direct order_id payment frees limit", async () => {
    const db = fakeDb({
      orders: [order(1, 120_000, "confirmed")],
      allocs: [],
      payments: [
        {
          id: 1,
          order_id: 1,
          amount: dec(120_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: null
        }
      ]
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, baseOpts);
    expect(out.toString()).toBe("0");
  });

  it("pending / voided allocations do not free limit", async () => {
    const db = fakeDb({
      orders: [order(1, 70_000, "new"), order(2, 60_000, "new")],
      allocs: [
        { order_id: 1, payment_id: 11, amount: dec(70_000) },
        { order_id: 2, payment_id: 12, amount: dec(60_000) }
      ],
      payments: [
        {
          id: 11,
          order_id: null,
          amount: dec(70_000),
          workflow_status: "pending_confirmation",
          entry_kind: "payment",
          deleted_at: null
        },
        {
          id: 12,
          order_id: 2,
          amount: dec(60_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: new Date("2026-08-02T00:00:00Z")
        }
      ]
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, baseOpts);
    expect(out.toString()).toBe("130000");
  });

  it("discount_settlement frees limit", async () => {
    const db = fakeDb({
      orders: [order(1, 40_000, "delivered")],
      allocs: [],
      payments: [
        {
          id: 1,
          order_id: 1,
          amount: dec(40_000),
          workflow_status: "confirmed",
          entry_kind: "discount_settlement",
          deleted_at: null
        }
      ]
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, baseOpts);
    expect(out.toString()).toBe("0");
  });

  it("uses max(alloc, direct) when both exist", async () => {
    const db = fakeDb({
      orders: [order(1, 100_000, "delivered")],
      allocs: [{ order_id: 1, payment_id: 9, amount: dec(30_000) }],
      payments: [
        {
          id: 9,
          order_id: null,
          amount: dec(30_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: null
        },
        {
          id: 10,
          order_id: 1,
          amount: dec(80_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: null
        }
      ]
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, baseOpts);
    expect(out.toString()).toBe("20000");
  });

  it("excludeOrderId removes that order from outstanding", async () => {
    const db = fakeDb({
      orders: [order(1, 100_000, "new"), order(2, 50_000, "new")],
      allocs: [],
      payments: []
    });
    const out = await computeAgentConsignmentOutstanding(db as never, 1, 10, {
      ...baseOpts,
      excludeOrderId: 1
    });
    expect(out.toString()).toBe("50000");
  });

  it("ignorePreviousMonthsDebt skips older unpaid", async () => {
    const db = fakeDb({
      orders: [
        order(1, 55_000, "new", new Date("2020-01-15T00:00:00Z")),
        order(2, 10_000, "new", new Date("2026-08-10T00:00:00Z"))
      ],
      allocs: [],
      payments: []
    });
    const all = await computeAgentConsignmentOutstanding(db as never, 1, 10, {
      ignorePreviousMonthsDebt: false,
      monthStartsAt
    });
    const ignored = await computeAgentConsignmentOutstanding(db as never, 1, 10, {
      ignorePreviousMonthsDebt: true,
      monthStartsAt
    });
    expect(all.toString()).toBe("65000");
    expect(ignored.toString()).toBe("10000");
  });

  it("remaining returns after debt paid: limit - outstanding", async () => {
    const limit = dec(1_000_000);
    const unpaidDb = fakeDb({
      orders: [order(1, 300_000, "picking")],
      allocs: [],
      payments: []
    });
    const unpaid = await computeAgentConsignmentOutstanding(unpaidDb as never, 1, 10, baseOpts);
    const remainingUnpaid = Prisma.Decimal.max(0, limit.sub(unpaid));
    expect(remainingUnpaid.toString()).toBe("700000");

    const paidDb = fakeDb({
      orders: [order(1, 300_000, "picking")],
      allocs: [{ order_id: 1, payment_id: 9, amount: dec(300_000) }],
      payments: [
        {
          id: 9,
          order_id: null,
          amount: dec(300_000),
          workflow_status: "confirmed",
          entry_kind: "payment",
          deleted_at: null
        }
      ]
    });
    const paid = await computeAgentConsignmentOutstanding(paidDb as never, 1, 10, baseOpts);
    const remainingPaid = Prisma.Decimal.max(0, limit.sub(paid));
    expect(paid.toString()).toBe("0");
    expect(remainingPaid.toString()).toBe("1000000");
    expect(remainingPaid.sub(remainingUnpaid).toString()).toBe("300000");
  });
});
