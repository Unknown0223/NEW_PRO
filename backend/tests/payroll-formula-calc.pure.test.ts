import { describe, expect, it } from "vitest";
import {
  evaluateFormula,
  normalizeVarName,
  parseFormula,
  validateFormula
} from "../src/modules/payroll/payroll.formula-engine";
import { computePayroll, type CalcItem } from "../src/modules/payroll/payroll.calc.pure";
import { knownVariableSet, type PayrollCalcInputs } from "../src/modules/payroll/payroll.formula-vars";
import { ZERO_METRICS } from "../src/modules/payroll/payroll-kpi-fact.pure";

const vars = (o: Record<string, number>) => new Map(Object.entries(o).map(([k, v]) => [normalizeVarName(k), v]));
const ev = (text: string, o: Record<string, number> = {}) => evaluateFormula(parseFormula(text), vars(o)).value;

describe("payroll formula engine", () => {
  it("arifmetika, ustunlik va daraja", () => {
    expect(ev("2 + 3 * 4")).toBe(14);
    expect(ev("(2 + 3) * 4")).toBe(20);
    expect(ev("2 ^ 3 ^ 2")).toBe(512);
    expect(ev("-5 + 2")).toBe(-3);
    expect(ev("1 000 000 / 4")).toBe(250000);
  });

  it("ЕСЛИ, И/ИЛИ, taqqoslash", () => {
    expect(ev("ЕСЛИ([A] >= 100, 1, 2)", { A: 100 })).toBe(1);
    expect(ev("ЕСЛИ([A] <> 100; 1; 2)", { A: 100 })).toBe(2);
    expect(ev("ЕСЛИ(И([A] > 1, [B] > 1), 10)", { A: 2, B: 0 })).toBe(0);
    expect(ev("ЕСЛИ(ИЛИ([A] > 1, [B] > 1), 10)", { A: 2, B: 0 })).toBe(10);
    expect(ev("НЕ([A])", { A: 0 })).toBe(1);
  });

  it("yuqori darajadagi `shart, a, b` = ЕСЛИ", () => {
    expect(ev("[KPI - АКБ (Факт)] >= 50, 300000, 0", { "KPI - АКБ (Факт)": 60 })).toBe(300000);
    expect(ev("[KPI - АКБ (Факт)] >= 50, 300000", { "KPI - АКБ (Факт)": 10 })).toBe(0);
  });

  it("ОКРУГЛ / ВВЕРХ / ВНИЗ / MIN / MAX", () => {
    expect(ev("ОКРУГЛ(2.345, 2)")).toBe(2.35);
    expect(ev("ОКРУГЛВВЕРХ(2.301, 1)")).toBe(2.4);
    expect(ev("ОКРУГЛВНИЗ(2.399, 1)")).toBe(2.3);
    expect(ev("ОКРУГЛ(1234567, -3)")).toBe(1235000);
    expect(ev("MIN(5, 2, 9) + МАКС(1, 7)")).toBe(9);
  });

  it("nolga bo'lish 0 va ogohlantirish", () => {
    const r = evaluateFormula(parseFormula("[A] / [B]"), vars({ A: 5, B: 0 }));
    expect(r.value).toBe(0);
    expect(r.warnings).toContain("division_by_zero");
  });

  it("validatsiya: sintaksis va noma'lum o'zgaruvchi", () => {
    const known = knownVariableSet(["Бонус"]);
    expect(validateFormula("[Базовый оклад] * 0.1 + [бонус]", known).ok).toBe(true);
    expect(validateFormula("[Нет такой] + 1", known).unknown).toEqual(["Нет такой"]);
    expect(validateFormula("ЕСЛИ(1, 2", known).ok).toBe(false);
    expect(validateFormula("СТРАННО(1)", known).error).toMatch(/Неизвестная функция/);
    expect(validateFormula("", known).ok).toBe(false);
  });
});

const baseInputs = (o: Partial<PayrollCalcInputs> = {}): PayrollCalcInputs => ({
  base_full: 3_000_000,
  base_salary: 3_000_000,
  plan_days: 24,
  worked_days: 24,
  vacation_days: 0,
  sick_days: 0,
  trip_days: 0,
  absent_days: 0,
  half_days: 0,
  fact_total: { ...ZERO_METRICS, cost: 100_000_000, acb: 60 },
  fact_by_group: new Map([[7, { ...ZERO_METRICS, cost: 40_000_000 }]]),
  returned_sum: 0,
  plan_total: { ...ZERO_METRICS, cost: 80_000_000 },
  plan_by_group: new Map([[7, { ...ZERO_METRICS, cost: 50_000_000 }]]),
  expeditor: { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 },
  team_total: null,
  team_by_group: null,
  advances_paid: 0,
  ...o
});

const items = new Map<number, CalcItem>([
  [1, { id: 1, name: "Бонус KPI", type: "allowance", system_key: null }],
  [2, { id: 2, name: "Штраф", type: "deduction", system_key: null }],
  [900, { id: 900, name: "Аванс", type: "deduction", system_key: "advance" }],
  [910, { id: 910, name: "Корректировка", type: "allowance", system_key: "correction" }],
  [920, { id: 920, name: "Qarzdorlik", type: "deduction", system_key: "carry" }]
]);
const systemIds = { advance: 900, correction: 910, carry: 920 };

describe("computePayroll", () => {
  it("Аванс gross ga kirmaydi, balansdan bir marta ayiriladi", () => {
    const r = computePayroll({
      inputs: baseInputs({ advances_paid: 1_000_000 }),
      items,
      salaryFormula: null,
      formulas: [{ ref: "f1", text: "[KPI - Сумма (Факт)] * 0.01", target_item_id: 1, kpi_group_id: null, priority: 1 }],
      kept: [{ item_id: 2, amount: 50_000, source: "manual", corr_key: "", is_manual_override: false }],
      systemIds,
      carryAmount: 0,
      salaryPaid: 500_000
    });
    expect(r.allowances_total).toBe(1_000_000);
    expect(r.deductions_total).toBe(50_000);
    expect(r.gross).toBe(3_950_000);
    expect(r.paid_total).toBe(1_500_000);
    expect(r.balance).toBe(2_450_000);
    expect(r.lines.find((l) => l.item_id === 900)?.amount).toBe(1_000_000);
  });

  it("KPI guruh bo'yicha bonus va qo'lda override saqlanadi", () => {
    const r = computePayroll({
      inputs: baseInputs(),
      items,
      salaryFormula: null,
      formulas: [{ ref: "b1", text: "ЕСЛИ([KPI - Выполнение (%)] >= 80, 200000, 0)", target_item_id: 1, kpi_group_id: 7, priority: 1 }],
      kept: [{ item_id: 1, amount: 123, source: "formula", corr_key: "", is_manual_override: true }],
      systemIds,
      carryAmount: 0,
      salaryPaid: 0
    });
    expect(r.formula_values.b1).toBe(200000);
    expect(r.lines.find((l) => l.item_id === 1)?.amount).toBe(123);
    expect(r.gross).toBe(3_000_123);
  });

  it("Qarzdorlik va manfiy Корректировка gross ni kamaytiradi", () => {
    const r = computePayroll({
      inputs: baseInputs(),
      items,
      salaryFormula: "[Базовый оклад] / [Кол-во рабочих дней текущего месяца] * 12",
      formulas: [],
      kept: [{ item_id: 910, amount: -200_000, source: "correction", corr_key: "2026-08", is_manual_override: false }],
      systemIds,
      carryAmount: 300_000,
      salaryPaid: 0
    });
    expect(r.base_salary).toBe(1_500_000);
    expect(r.gross).toBe(1_500_000 - 200_000 - 300_000);
  });

  it("formula xatosi qatorni 0 qiladi va xatoni qaytaradi", () => {
    const r = computePayroll({
      inputs: baseInputs(),
      items,
      salaryFormula: null,
      formulas: [{ ref: "x", text: "[Нет] * 2", target_item_id: 1, kpi_group_id: null, priority: 1 }],
      kept: [],
      systemIds,
      carryAmount: 0,
      salaryPaid: 0
    });
    expect(r.errors.length).toBe(1);
    expect(r.gross).toBe(3_000_000);
  });
});
