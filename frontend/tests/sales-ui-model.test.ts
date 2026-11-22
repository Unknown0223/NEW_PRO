import { describe, expect, it } from "vitest";
import { buildSalesProUiModel } from "@/components/dashboard/sales-monitoring/sales-ui-model";

describe("buildSalesProUiModel", () => {
  it("maps plan_fact and akb_okb into summary fields", () => {
    const model = buildSalesProUiModel({
      plan_fact: { plan_sales: "1000", fact_sales: "800", execution_pct: 80, plan_note: "" },
      akb_okb: { akb: 40, okb: 100, coverage_pct: 40 },
      daily_sales: [{ day: "2026-11-01", sales_sum: "100", orders_count: 2 }],
      category_sales: [{ category: "A", sales_sum: "800", share_pct: 100 }],
      branch_performance: [],
      trade_directions: [],
      supervisor_performance: [],
      period: { from: "2026-11-01", to: "2026-11-30" }
    });
    expect(model.plan).toBe(1000);
    expect(model.fact).toBe(800);
    expect(model.completionPct).toBe(80);
    expect(model.akb).toBe(40);
    expect(model.okb).toBe(100);
    expect(model.categoryRows[0]?.name).toBe("A");
  });

  it("null snapshot yields zeros and empty arrays (no throw)", () => {
    const model = buildSalesProUiModel(null);
    expect(model.plan).toBe(0);
    expect(model.days).toEqual([]);
  });
});
