import { describe, expect, it } from "vitest";
import { buildSupervisorProUiModel } from "@/components/dashboard/supervisor/pro/supervisor-ui-model";

describe("buildSupervisorProUiModel", () => {
  it("maps KPI plan/fact, payments and visit stats from snapshot", () => {
    const model = buildSupervisorProUiModel({
      filters: { date: "2026-11-15" },
      kpi: {
        monthly_kpi_plan_sum: "1000000",
        monthly_kpi_fact_mtd_sum: "400000",
        monthly_kpi_execution_pct: 40,
        sales_by_payment_method: [
          { method: "Наличные", sum: "250000" },
          { method: "Перечисление", sum: "150000" }
        ],
        planned_visits: 100,
        visited_total: 80,
        successful_visits: 60,
        gps_visits: 50,
        photo_reports: 40,
        visit_pct: 80,
        success_pct: 75,
        gps_pct: 62.5,
        photo_pct: 50
      },
      product_analytics: {
        by_category: [
          {
            dimension: "Напитки",
            share_pct: 100,
            revenue: "400000",
            quantity: "20",
            akb: 12
          }
        ],
        by_group: [],
        by_brand: []
      },
      visit_report: {
        rows: [
          {
            agent_id: 7,
            agent_name: "Агент Тест",
            agent_code: "AG-07",
            supervisor_name: "СВ",
            planned_visits: 10,
            visited_total: 8,
            visits_with_orders: 5,
            gps_visits: 4,
            photo_reports: 3,
            photo_outlets: 2,
            photo_count: 3,
            sales_sum: "50000"
          }
        ]
      }
    });

    expect(model.planApproved).toBe(1000000);
    expect(model.mtdFact).toBe(400000);
    expect(model.completionPct).toBe(40);
    expect(model.planPending).toBeNull();
    expect(model.methodRows).toHaveLength(2);
    expect(model.methodRows[0]?.name).toBe("Наличные");
    expect(model.statCards[0]?.pct).toBe(80);
    expect(model.catalogByTab.categories[0]?.name).toBe("Напитки");
    expect(model.agentVisitRows[0]?.id).toBe("7");
    expect(model.agentVisitRows[0]?.code).toBe("AG-07");
    expect(model.agentVisitRows[0]?.photos).toBe(3);
    expect(model.agentVisitRows[0]?.photoOutlets).toBe(2);
    expect(model.agentVisitRows[0]?.completion).toBe(80);
  });

  it("null snapshot yields zeros and empty arrays (no throw)", () => {
    const model = buildSupervisorProUiModel(null);
    expect(model.planApproved).toBe(0);
    expect(model.methodRows).toEqual([]);
    expect(model.agentVisitRows).toEqual([]);
    expect(model.planPending).toBeNull();
  });

  it("does not invent daily spark data", () => {
    const model = buildSupervisorProUiModel({
      filters: { date: "2026-11-01" },
      kpi: { monthly_kpi_plan_sum: "100", monthly_kpi_fact_mtd_sum: "10" }
    });
    expect(model).not.toHaveProperty("dailySpark");
    expect(model).not.toHaveProperty("days");
    expect(model.planPending).toBeNull();
  });
});
