import { describe, expect, it } from "vitest";
import { computePayroll, type CalcItem } from "../src/modules/payroll/payroll.calc.pure";
import { ZERO_METRICS } from "../src/modules/payroll/payroll-kpi-fact.pure";
import type { PayrollCalcInputs } from "../src/modules/payroll/payroll.formula-vars";
import { scalePay, tenureMonths } from "../src/modules/payroll/payroll.scheme.pure";
import { parseSchemeRule, type EmployeeAttrs, type SchemeRule } from "../src/modules/payroll/payroll.scheme.types";

const inputs = (o: Partial<PayrollCalcInputs> = {}): PayrollCalcInputs => ({
  base_full: 0,
  base_salary: 0,
  plan_days: 26,
  worked_days: 24,
  vacation_days: 0,
  sick_days: 0,
  trip_days: 0,
  absent_days: 0,
  half_days: 0,
  fact_total: { ...ZERO_METRICS, cost: 54_700_000, acb: 104 },
  fact_by_group: new Map([
    [1, { ...ZERO_METRICS, cost: 47_500_000 }],
    [2, { ...ZERO_METRICS, cost: 7_200_000 }]
  ]),
  returned_sum: 1_000_000,
  plan_total: { ...ZERO_METRICS, cost: 60_000_000, acb: 100 },
  plan_by_group: new Map([
    [1, { ...ZERO_METRICS, cost: 50_000_000 }],
    [2, { ...ZERO_METRICS, cost: 10_000_000 }]
  ]),
  expeditor: { delivered_count: 120, delivered_sum: 300_000_000, delivered_volume: 0, clients: 80 },
  team_total: null,
  team_by_group: null,
  advances_paid: 0,
  ...o
});

const items = new Map<number, CalcItem>([
  [10, { id: 10, name: "Дорожные", type: "allowance", system_key: null }],
  [11, { id: 11, name: "KPI", type: "allowance", system_key: null }],
  [12, { id: 12, name: "Доставка", type: "allowance", system_key: null }],
  [13, { id: 13, name: "Связь", type: "allowance", system_key: null }],
  [14, { id: 14, name: "Штраф", type: "deduction", system_key: null }],
  [900, { id: 900, name: "Аванс", type: "deduction", system_key: "advance" }],
  [910, { id: 910, name: "Корректировка", type: "allowance", system_key: "correction" }],
  [920, { id: 920, name: "Qarzdorlik", type: "deduction", system_key: "carry" }]
]);
const systemIds = { advance: 900, correction: 910, carry: 920 };
const attrs: EmployeeAttrs = { branch: "SAM", trade_direction_id: 1, position: null, tenure_months: 12 };

const rule = (row: { code: string; name: string; kind: string; item_id: number | null; params: unknown }): SchemeRule => {
  const r = parseSchemeRule(row);
  if ("error" in r) throw new Error(r.error);
  return r;
};

const STD_SCALE = [
  { at: 70, pay: 50 },
  { at: 100, pay: 100 },
  { at: 120, pay: 120 }
];

const agentRules = (): SchemeRule[] => [
  rule({ code: "base", name: "Оклад", kind: "base", item_id: null, params: { amount: 3_000_000 } }),
  rule({
    code: "road",
    name: "Дорожные",
    kind: "fixed",
    item_id: 10,
    params: { amount: 400_000, prorate: true, cases: [{ when: [{ field: "branch", op: "in", value: ["SAM"] }], amount: 520_000 }] }
  }),
  rule({
    code: "kpi",
    name: "KPI",
    kind: "kpi",
    item_id: 11,
    params: {
      fund: 1_500_000,
      parts: [
        { metric: "cost", mode: "groups", weight: 70 },
        { metric: "acb", mode: "total", weight: 30 }
      ],
      scale: STD_SCALE,
      gates: [{ when: [{ field: "return_pct", op: ">", value: 5 }], factor: 0.8 }]
    }
  })
];

/** ЖС 95% → 91.67% × 1.05M × 50/60; POMPI 72% → 53.33% × 1.05M × 10/60; АКБ 104% × 450k. */
const KPI_TOTAL = r2(r2(1_050_000 * (5 / 6) * (275 / 300)) + r2(1_050_000 * (1 / 6) * (160 / 300)) + 468_000);

const run = (rules: SchemeRule[], o: Partial<PayrollCalcInputs> = {}, overrides = new Map<string, number>(), kept: Parameters<typeof computePayroll>[0]["kept"] = []) =>
  computePayroll({
    inputs: inputs(o),
    items,
    salaryFormula: null,
    formulas: [],
    kept,
    systemIds,
    carryAmount: 0,
    salaryPaid: 0,
    scheme: { scheme_id: 1, rules, attrs, overrides, groupNames: new Map([[1, "ЖС"], [2, "POMPI"]]) }
  });

describe("scalePay", () => {
  it("pastda 0, oraliq chiziqli, yuqorida to'xtaydi", () => {
    expect(scalePay(STD_SCALE, 69.9)).toBe(0);
    expect(scalePay(STD_SCALE, 70)).toBe(50);
    expect(scalePay(STD_SCALE, 85)).toBe(75);
    expect(scalePay(STD_SCALE, 110)).toBe(110);
    expect(scalePay(STD_SCALE, 150)).toBe(120);
  });
});

describe("scheme payroll", () => {
  it("oklad ish kuniga, yo'l puli filial sharti bilan, KPI guruhlar reja ulushida", () => {
    const r = run(agentRules());
    expect(r.base_salary).toBe(2_769_230.77);
    expect(r.base_explain?.text).toContain("24 / 26");
    const road = r.lines.find((l) => l.item_id === 10)!;
    expect(road.amount).toBe(480_000);
    expect(road.explain?.notes).toEqual(["по условию"]);
    const kpi = r.lines.find((l) => l.item_id === 11)!;
    expect(kpi.explain?.parts?.map((p) => p.label)).toEqual(["ЖС · Сумма", "POMPI · Сумма", "АКБ (общий план)"]);
    expect(kpi.explain?.parts?.map((p) => p.pay_pct)).toEqual([91.67, 53.33, 104]);
    expect(kpi.amount).toBe(KPI_TOTAL);
    expect(r.gross).toBe(r2(2_769_230.77 + 480_000 + KPI_TOTAL));
  });

  it("darvoza: qaytarish 5% dan oshsa KPI × 0.8; xodim farqi ustun", () => {
    const r = run(agentRules(), { returned_sum: 5_000_000 }, new Map([["road", 100_000]]));
    const kpi = r.lines.find((l) => l.item_id === 11)!;
    expect(kpi.amount).toBe(r2(KPI_TOTAL * 0.8));
    expect(kpi.explain?.notes).toContain("× 0.8 по условию");
    expect(r.lines.find((l) => l.item_id === 10)!.explain?.notes).toEqual(["индивидуально"]);
  });

  it("yangi xodim kafolati va reja yo'q bo'lsa ogohlantirish", () => {
    const rules = [
      rule({
        code: "kpi",
        name: "KPI",
        kind: "kpi",
        item_id: 11,
        params: {
          fund: 1_000_000,
          parts: [{ metric: "cost", mode: "total", weight: 100 }],
          scale: STD_SCALE,
          gates: [{ when: [{ field: "tenure_months", op: "<", value: 2 }], min_pay: 70 }]
        }
      })
    ];
    const r = computePayroll({
      inputs: inputs({ plan_total: { ...ZERO_METRICS }, plan_by_group: new Map() }),
      items,
      salaryFormula: null,
      formulas: [],
      kept: [],
      systemIds,
      carryAmount: 0,
      salaryPaid: 0,
      scheme: { scheme_id: 1, rules, attrs: { ...attrs, tenure_months: 1 }, overrides: new Map(), groupNames: new Map() }
    });
    expect(r.lines.find((l) => l.item_id === 11)!.amount).toBe(700_000);
    expect(r.warnings).toContain("kpi:no_plan");
  });

  it("stavka (ekspeditor %), formula «Оклад статьи» bilan, qo'lda summa saqlanadi", () => {
    const rules = [
      rule({ code: "dlv", name: "Доставка", kind: "rate", item_id: 12, params: { metric: "exp_sum", rate: 0.1, percent: true } }),
      rule({ code: "tel", name: "Связь", kind: "formula", item_id: 13, params: { text: "[Оклад статьи] * [Всего отработанных дней] / [Кол-во рабочих дней текущего месяца]", amount: 260_000 } }),
      rule({ code: "fine", name: "Штраф", kind: "manual", item_id: 14, params: {} })
    ];
    const r = run(rules, {}, new Map(), [
      { item_id: 13, amount: 50_000, source: "formula", corr_key: "", is_manual_override: true },
      { item_id: 14, amount: 30_000, source: "manual", corr_key: "", is_manual_override: false }
    ]);
    expect(r.lines.find((l) => l.item_id === 12)!.amount).toBe(300_000);
    const tel = r.lines.find((l) => l.item_id === 13)!;
    expect(tel.amount).toBe(50_000);
    expect(tel.explain?.notes?.[0]).toBe("по расчёту 240000");
    expect(r.deductions_total).toBe(30_000);
    expect(r.base_salary).toBe(0);
  });

  it("noto'g'ri parametr — aniq xato", () => {
    expect(parseSchemeRule({ code: "x", name: "KPI", kind: "kpi", item_id: 1, params: { fund: 1 } })).toHaveProperty("error");
    expect(parseSchemeRule({ code: "x", name: "Связь", kind: "fixed", item_id: null, params: { amount: 1 } })).toEqual({ error: "Связь: не выбрана статья" });
  });

  it("staj oylarda", () => {
    expect(tenureMonths(new Date("2026-08-15T00:00:00Z"), 2026, 10)).toBe(2);
    expect(tenureMonths(null, 2026, 10)).toBeNull();
  });
});

function r2(x: number) {
  return Math.round(x * 100) / 100;
}
