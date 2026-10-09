import { describe, expect, it } from "vitest";
import { validateFormula } from "../src/modules/payroll/payroll.formula-engine";
import { computePayroll, type CalcFormula, type CalcItem } from "../src/modules/payroll/payroll.calc.pure";
import { knownVariableSet, type PayrollCalcInputs } from "../src/modules/payroll/payroll.formula-vars";
import { ZERO_METRICS, type KpiMetrics } from "../src/modules/payroll/payroll-kpi-fact.pure";
import {
  RES_AGENT_KPI,
  RES_FORMULAS,
  RES_ITEMS,
  RES_PRORATED,
  RES_TEAM_KPI
} from "../src/modules/payroll/payroll.preset.pure";

const ROAD = 1;
const KPI1 = 2;
const KPI2 = 3;
const KPI3 = 4;
const G1 = 11;
const G2 = 12;
const G3 = 13;

const items = new Map<number, CalcItem>([
  [ROAD, { id: ROAD, name: "Дорожные", type: "allowance", system_key: null }],
  [KPI1, { id: KPI1, name: "KPI 1", type: "allowance", system_key: null }],
  [KPI2, { id: KPI2, name: "KPI 2", type: "allowance", system_key: null }],
  [KPI3, { id: KPI3, name: "KPI 3", type: "allowance", system_key: null }],
  [900, { id: 900, name: "Аванс", type: "deduction", system_key: "advance" }]
]);
const systemIds = { advance: 900, correction: 910, carry: 920 };
const cost = (v: number): KpiMetrics => ({ ...ZERO_METRICS, cost: v });

/** Excel: norma 25 kun, FIXSA 2 000 000 → «Оклад за отработанное время» = 2 000 000 / 25 × kun. */
const agent = (days: number, plan: number[], fact: number[], parts: Array<[number, number]>): PayrollCalcInputs => ({
  base_full: 2_000_000,
  base_salary: (2_000_000 / 25) * days,
  plan_days: 25,
  worked_days: days,
  vacation_days: 0,
  sick_days: 0,
  trip_days: 0,
  absent_days: 0,
  half_days: 0,
  fact_total: cost(fact.reduce((a, b) => a + b, 0)),
  fact_by_group: new Map([G1, G2, G3].map((g, i) => [g, cost(fact[i] ?? 0)])),
  returned_sum: 0,
  plan_total: cost(plan.reduce((a, b) => a + b, 0)),
  plan_by_group: new Map([G1, G2, G3].map((g, i) => [g, cost(plan[i] ?? 0)])),
  expeditor: { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 },
  team_total: null,
  team_by_group: null,
  advances_paid: 0,
  item_parts: new Map([[ROAD, 1_000_000], ...parts])
});

const agentFormulas = (text = RES_AGENT_KPI): CalcFormula[] => [
  { ref: "road", text: RES_PRORATED, target_item_id: ROAD, kpi_group_id: null, priority: 10 },
  { ref: "k1", text, target_item_id: KPI1, kpi_group_id: G1, priority: 50 },
  { ref: "k2", text, target_item_id: KPI2, kpi_group_id: G2, priority: 50 },
  { ref: "k3", text, target_item_id: KPI3, kpi_group_id: G3, priority: 50 }
];

const run = (inputs: PayrollCalcInputs, formulas: CalcFormula[]) =>
  computePayroll({ inputs, items, salaryFormula: null, formulas, kept: [], systemIds, carryAmount: 0, salaryPaid: 0 });

describe("РЕС preset — Excel AVGUST_2026 bilan bir xil", () => {
  it("preset formulalari sintaktik to'g'ri va o'zgaruvchilari ma'lum", () => {
    const known = knownVariableSet(RES_ITEMS.map((i) => i.name));
    for (const f of RES_FORMULAS) expect(validateFormula(f.text, known)).toMatchObject({ ok: true });
  });

  it("PMAND004: 23 kun, KPI_2 63.44% → OYLIK 4 028 872.73", () => {
    const r = run(
      agent(23, [100_000_000, 110_000_000, 50_000_000], [21_950_000, 69_788_000, 0], [
        [KPI1, 1_700_000],
        [KPI2, 2_000_000],
        [KPI3, 1_700_000]
      ]),
      agentFormulas()
    );
    expect(r.errors).toEqual([]);
    expect(r.base_salary).toBe(1_840_000);
    expect(r.lines.find((l) => l.item_id === ROAD)?.amount).toBe(920_000);
    expect(r.lines.find((l) => l.item_id === KPI1)).toBeUndefined();
    expect(r.lines.find((l) => l.item_id === KPI2)?.amount).toBe(1_268_872.73);
    expect(r.gross).toBe(4_028_872.73);
  });

  it("PMNAM004: KPI_1 126.77% → 120% cheklov, manfiy fakt → 0; OYLIK 4 800 000", () => {
    const r = run(
      agent(20, [100_000_000, 100_000_000], [126_770_000, -37_060_000], [
        [KPI1, 2_000_000],
        [KPI2, 2_000_000]
      ]),
      agentFormulas()
    );
    expect(r.lines.find((l) => l.item_id === KPI1)?.amount).toBe(2_400_000);
    expect(r.lines.find((l) => l.item_id === KPI2)).toBeUndefined();
    expect(r.gross).toBe(4_800_000);
  });

  it("PMBX004: 0 ish kuni — oklad va yo'l 0, KPI kunga bo'linmaydi (KPI_3 → 1 490 580)", () => {
    const r = run(
      agent(0, [100_000_000, 100_000_000, 100_000_000], [5_930_000, 3_590_000, 74_529_000], [
        [KPI1, 2_200_000],
        [KPI2, 2_200_000],
        [KPI3, 2_000_000]
      ]),
      agentFormulas()
    );
    expect(r.base_salary).toBe(0);
    expect(r.lines.find((l) => l.item_id === ROAD)).toBeUndefined();
    expect(r.lines.find((l) => l.item_id === KPI3)?.amount).toBe(1_490_580);
    expect(r.gross).toBe(1_490_580);
  });

  it("PMNAM006: 135.06% → 120% × 2 400 000 = 2 880 000", () => {
    const r = run(agent(25, [100_000_000], [135_060_000], [[KPI1, 2_400_000]]), agentFormulas());
    expect(r.lines.find((l) => l.item_id === KPI1)?.amount).toBe(2_880_000);
  });

  it("60.9% chegarasidan past — 0, chegarada — to'lanadi", () => {
    const below = run(agent(25, [100_000_000], [60_899_999], [[KPI1, 2_000_000]]), agentFormulas());
    expect(below.lines.find((l) => l.item_id === KPI1)).toBeUndefined();
    const at = run(agent(25, [100_000_000], [60_900_000], [[KPI1, 2_000_000]]), agentFormulas());
    expect(at.lines.find((l) => l.item_id === KPI1)?.amount).toBe(1_218_000);
  });

  it("«формула» turidagi statya summasi biriktirmasiz to'lanmaydi", () => {
    const withCalc = new Map(items).set(KPI1, { ...items.get(KPI1)!, calc_type: "formula" });
    const r = computePayroll({
      inputs: agent(25, [], [], [[KPI1, 2_000_000]]),
      items: withCalc,
      salaryFormula: null,
      formulas: [],
      kept: [],
      systemIds,
      carryAmount: 0,
      salaryPaid: 0
    });
    expect(r.lines.find((l) => l.item_id === KPI1)).toBeUndefined();
    expect(r.lines.find((l) => l.item_id === ROAD)).toMatchObject({ amount: 1_000_000, source: "config" });
    expect(r.gross).toBe(3_000_000);
  });

  it("СВР: o'z rejasi yo'q — jamoa fakti / jamoa rejasi", () => {
    const inputs: PayrollCalcInputs = {
      ...agent(25, [], [], [[KPI1, 2_500_000]]),
      plan_by_group: new Map(),
      plan_total: cost(0),
      team_by_group: new Map([[G1, cost(150_000_000)]]),
      team_total: cost(150_000_000),
      team_plan_by_group: new Map([[G1, cost(200_000_000)]]),
      team_plan_total: cost(200_000_000)
    };
    const r = run(inputs, [{ ref: "s1", text: RES_TEAM_KPI, target_item_id: KPI1, kpi_group_id: G1, priority: 50 }]);
    expect(r.lines.find((l) => l.item_id === KPI1)?.amount).toBe(1_875_000);
  });
});
