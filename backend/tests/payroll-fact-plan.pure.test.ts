import { describe, expect, it } from "vitest";
import {
  aggregateKpiFact,
  allocatePeriodReturns,
  mergeUserFacts,
  type FactLine
} from "../src/modules/payroll/payroll-kpi-fact.pure";
import { splitSlotPlan } from "../src/modules/payroll/payroll-slot-plan.pure";

const line = (p: Partial<FactLine>): FactLine => ({
  order_id: 1,
  agent_id: 10,
  expeditor_user_id: null,
  work_slot_id: 100,
  client_id: 500,
  product_id: 1,
  qty: 10,
  total: 1000,
  volume_unit: 0.5,
  ...p
});

describe("aggregateKpiFact", () => {
  const groups = new Map<number, number[]>([
    [1, [7]],
    [2, [7, 8]]
  ]);

  it("delivered minus partial return, per group and total", () => {
    const lines = [line({}), line({ order_id: 2, client_id: 501, product_id: 2, qty: 5, total: 500 })];
    const res = aggregateKpiFact(lines, [{ order_id: 1, product_id: 1, qty: 4 }], groups);
    const f = res.get("10:100")!;
    expect(f.total.cost).toBe(1100);
    expect(f.total.count).toBe(11);
    expect(f.returned_sum).toBe(400);
    expect(f.byGroup.get(7)!.cost).toBe(1100);
    expect(f.byGroup.get(8)!.cost).toBe(500);
    expect(f.total.acb).toBe(2);
  });

  it("full return removes client from АКБ and order count", () => {
    const res = aggregateKpiFact([line({})], [{ order_id: 1, product_id: 1, qty: 10 }], groups);
    const f = res.get("10:100")!;
    expect(f.total.cost).toBe(0);
    expect(f.total.acb).toBe(0);
    expect(f.total.order_count).toBe(0);
  });

  it("history belongs to the person: facts split by order agent, merged across slots", () => {
    const lines = [
      line({ agent_id: 10, work_slot_id: 100 }),
      line({ order_id: 2, agent_id: 11, work_slot_id: 100 }),
      line({ order_id: 3, agent_id: 10, work_slot_id: 101, client_id: 500 })
    ];
    const res = aggregateKpiFact(lines, [], groups);
    expect(res.get("10:100")!.total.cost).toBe(1000);
    expect(res.get("11:100")!.total.cost).toBe(1000);
    const merged = mergeUserFacts(lines, [], groups, 10);
    expect(merged.total.cost).toBe(2000);
    expect(merged.total.acb).toBe(1);
  });
});

describe("allocatePeriodReturns", () => {
  it("distributes by qty share and reports unallocated", () => {
    const res = allocatePeriodReturns(
      [
        { return_id: 1, client_id: 500, product_id: 1, qty: 6 },
        { return_id: 1, client_id: 500, product_id: 9, qty: 2 }
      ],
      new Map([
        [
          1,
          [
            { order_id: 1, client_id: 500, product_id: 1, qty: 10 },
            { order_id: 2, client_id: 500, product_id: 1, qty: 20 }
          ]
        ]
      ])
    );
    const byOrder = new Map(res.allocs.map((a) => [a.order_id, a.qty]));
    expect(byOrder.get(1)).toBe(2);
    expect(byOrder.get(2)).toBe(4);
    expect(res.unallocated).toEqual([{ return_id: 1, product_id: 9, qty: 2 }]);
  });
});

describe("splitSlotPlan", () => {
  const days = Array.from({ length: 24 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  const plan = { cost: 50_000_000, count: 0, volume: 0, acb: 0, order_count: 0 };

  it("Ali 10 days, Vali 14 days: total 1× of slot plan", () => {
    const res = splitSlotPlan({
      slotWorkingDays: days,
      holders: [
        { userId: 1, startYmd: "2026-09-01", endYmdExcl: "2026-09-11" },
        { userId: 2, startYmd: "2026-09-11", endYmdExcl: null }
      ],
      targets: new Map([[1, plan]])
    });
    const ali = res.shares.get(1)!.plan.cost;
    const vali = res.shares.get(2)!.plan.cost;
    expect(ali).toBeCloseTo(20_833_333.33, 1);
    expect(vali).toBeCloseTo(29_166_666.67, 1);
    expect(ali + vali).toBeCloseTo(50_000_000, 0);
    expect(res.vacantDays).toBe(0);
  });

  it("new holder's explicit target wins, mismatch warned", () => {
    const res = splitSlotPlan({
      slotWorkingDays: days,
      holders: [
        { userId: 1, startYmd: "2026-09-01", endYmdExcl: "2026-09-11" },
        { userId: 2, startYmd: "2026-09-11", endYmdExcl: null }
      ],
      targets: new Map([
        [1, plan],
        [2, { ...plan, cost: 10_000_000 }]
      ])
    });
    expect(res.shares.get(2)).toMatchObject({ source: "explicit" });
    expect(res.shares.get(2)!.plan.cost).toBe(10_000_000);
    expect(res.warnings).toContain("slot_plan_sum_mismatch");
  });

  it("vacant days are not given to anyone", () => {
    const res = splitSlotPlan({
      slotWorkingDays: days,
      holders: [{ userId: 1, startYmd: "2026-09-01", endYmdExcl: "2026-09-13" }],
      targets: new Map([[1, plan]])
    });
    expect(res.shares.get(1)!.plan.cost).toBe(25_000_000);
    expect(res.vacantDays).toBe(12);
    expect(res.warnings).toContain("vacant_slot_days");
  });
});
