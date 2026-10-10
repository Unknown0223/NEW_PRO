import { describe, expect, it } from "vitest";
import {
  achievementTone,
  calcTotalsFromRows,
  currentMonth,
  formulaConfigSummary,
  formulaSummary,
  gridStepSummary,
  kindLabel,
  monthLabel,
  recentMonths,
  remainingAmount,
  roleLabel,
  sortGridSteps
} from "@/components/payroll/payroll-utils";
import type { PayrollEntryRow } from "@/components/payroll/payroll-api";

function entry(over: Partial<PayrollEntryRow> = {}): PayrollEntryRow {
  return {
    id: 1,
    user_id: 1,
    fio: "A",
    role: "agent",
    formula_id: 1,
    formula_name: "F",
    kind: "kpi_bonus",
    kpi_group_id: 1,
    base_amount: 2_000_000,
    variable_amount: 1_000_000,
    allowance_amount: 100_000,
    deduction_amount: 50_000,
    adjustment_amount: 0,
    gross_amount: 3_100_000,
    net_amount: 3_050_000,
    worked_days: 22,
    planned_days: 22,
    achievement_percent: 110,
    breakdown: [],
    status: "calculated",
    comment: null,
    paid_amount: 0,
    metrics: {},
    ...over
  };
}

describe("payroll utils: sana va format", () => {
  it("oy nomini chiqaradi", () => {
    expect(monthLabel("2026-10")).toBe("Октябрь 2026");
    expect(monthLabel("2026-01")).toBe("Январь 2026");
    expect(monthLabel("buzilgan")).toBe("—");
    expect(monthLabel(null)).toBe("—");
  });

  it("joriy va oxirgi oylar", () => {
    const now = new Date(2026, 9, 10); // 2026-10-10
    expect(currentMonth(now)).toBe("2026-10");
    expect(recentMonths(3, now)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });
});

describe("payroll utils: formula tavsifi", () => {
  it("hisob turi nomlari", () => {
    expect(kindLabel("kpi_bonus")).toBe("Оклад + KPI (сетка)");
    expect(kindLabel("team_percent")).toBe("% от продаж команды");
    expect(kindLabel("noma’lum")).toBe("noma’lum");
  });

  it("config xulosasi", () => {
    expect(formulaConfigSummary("fixed", {})).toBe("faqat oklad");
    expect(formulaConfigSummary("percent_sales", { percent: 2 })).toContain("2,00%");
    expect(formulaConfigSummary("piece", { rate_per_unit: 1500, unit_metric: "warehouse_ops" })).toContain("birlik");
    expect(formulaConfigSummary("fixed", { attendance_prorate: "none" })).toContain("davomat");
  });

  it("formula xulosasi: oklad + сетка", () => {
    const text = formulaSummary({
      kind: "kpi_bonus",
      base_amount: 2_000_000,
      grid_name: "Agent KPI",
      config: { percent: 10 }
    });
    expect(text).toContain("Оклад");
    expect(text).toContain("Agent KPI");
    expect(text).toContain("10,00%");
  });

  it("setka bosqichi matni", () => {
    expect(gridStepSummary("coefficient", { month: null, from_value: 100, to_value: null, coefficient: 1.5, amount: 0 })).toContain("×1,50");
    expect(gridStepSummary("percent", { month: null, from_value: null, to_value: 100, coefficient: 1, amount: 0.5 })).toContain("0,50%");
    expect(gridStepSummary("amount", { month: null, from_value: 0, to_value: 10, coefficient: 1, amount: 500000 })).toContain("500");
  });

  it("setka qatorlarini saralaydi (baza → oylik)", () => {
    const sorted = sortGridSteps([
      { month: "2026-10", from_value: 100, to_value: null, coefficient: 2, amount: 0 },
      { month: null, from_value: 200, to_value: null, coefficient: 1, amount: 0 },
      { month: null, from_value: 0, to_value: 200, coefficient: 0.5, amount: 0 }
    ]);
    expect(sorted[0]).toMatchObject({ month: null, from_value: 0 });
    expect(sorted[1]).toMatchObject({ month: null, from_value: 200 });
    expect(sorted[2]).toMatchObject({ month: "2026-10" });
  });
});

describe("payroll utils: hisob yig‘indilari", () => {
  it("qatorlardan jami hisoblaydi", () => {
    const totals = calcTotalsFromRows([
      entry({ base_amount: 1_000_000, net_amount: 1_500_000, gross_amount: 1_500_000 }),
      entry({ user_id: 2, formula_id: null, base_amount: 0, net_amount: 0, gross_amount: 0, paid_amount: 0 })
    ]);
    expect(totals.employees).toBe(2);
    expect(totals.without_formula).toBe(1);
    expect(totals.base_amount).toBe(1_000_000);
    expect(totals.net_amount).toBe(1_500_000);
  });

  it("qolgan summa", () => {
    expect(remainingAmount(3_000_000, 1_000_000)).toBe(2_000_000);
    expect(remainingAmount(3_000_000, 3_000_000)).toBe(0);
    expect(remainingAmount(NaN, 100)).toBe(-100);
  });

  it("KPI bajarilish rangi", () => {
    expect(achievementTone(120)).toBe("good");
    expect(achievementTone(95)).toBe("warn");
    expect(achievementTone(50)).toBe("bad");
    expect(achievementTone(null)).toBe("muted");
  });

  it("rol nomi", () => {
    const roles = [{ role: "agent", label: "Агент (торговый)" }];
    expect(roleLabel("agent", roles)).toBe("Агент (торговый)");
    expect(roleLabel("driver", roles)).toBe("driver");
    expect(roleLabel(null, roles)).toBe("—");
  });
});
