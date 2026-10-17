import { describe, expect, it } from "vitest";
import {
  APPROVED_ONLY_KPI_PLAN_STATUSES,
  OFFICIAL_KPI_PLAN_STATUSES,
  WORKING_KPI_PLAN_STATUSES,
  executionPctFromPlanFact,
  monitoringPlanNote
} from "../src/modules/plans/plans.monitoring-aggregates";

describe("plans KPI status sets", () => {
  it("official KPI includes pending_approval (После «Подтвердить» dashboardda ko‘rinsin)", () => {
    expect([...OFFICIAL_KPI_PLAN_STATUSES]).toEqual(["approved", "pending_approval"]);
    expect([...WORKING_KPI_PLAN_STATUSES]).toEqual(["approved", "pending_approval"]);
    expect([...APPROVED_ONLY_KPI_PLAN_STATUSES]).toEqual(["approved"]);
  });

  it("monitoring note reflects pending + approved", () => {
    expect(monitoringPlanNote(true)).toMatch(/На согласовании|Одобрено/);
    expect(monitoringPlanNote(false)).toMatch(/Подтвердить|Одобрить|Установка планов/);
  });

  it("execution pct null when plan is zero", () => {
    expect(executionPctFromPlanFact(0, 88_000_000)).toBeNull();
    expect(executionPctFromPlanFact(100, 50)).toBe(50);
  });
});

/**
 * UI totals-section: faqat agentlar. Aggregat ham shunday bo‘lishi kerak —
 * SVR qatori + agentlar qatori birga SUM qilinsa double-count.
 */
export function sumAgentOnlyPlanCosts(
  rows: Array<{ role: string; cost: number }>
): number {
  return rows.filter((r) => r.role === "agent").reduce((s, r) => s + r.cost, 0);
}

describe("plans agent-only rollup", () => {
  it("supervisor + agents birga qo‘shilmaydi", () => {
    const rows = [
      { role: "supervisor", cost: 61_500_000 },
      { role: "agent", cost: 15_000_000 },
      { role: "agent", cost: 15_000_000 },
      { role: "agent", cost: 15_000_000 },
      { role: "agent", cost: 16_500_000 }
    ];
    expect(rows.reduce((s, r) => s + r.cost, 0)).toBe(123_000_000);
    expect(sumAgentOnlyPlanCosts(rows)).toBe(61_500_000);
  });
});
