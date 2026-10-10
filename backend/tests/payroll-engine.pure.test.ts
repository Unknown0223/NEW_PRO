/**
 * ЗАРПЛАТА — engine pure testlari.
 *
 * Qamrov: formula tanlash (KPI guruh bog‘lanishi), сетка bosqichlari (oylik/baza),
 * rol bo‘yicha hisob usullari, shartlar (gates), ustama/ushlanmalar,
 * davomat proporsiyasi, chegaralar va oylik jami.
 */
import { describe, expect, it } from "vitest";
import {
  computePayrollEntry,
  computePayrollMonth,
  emptyMetrics,
  mergeMetrics,
  resolveFormula
} from "../src/modules/payroll/payroll.engine";
import { pickGridSteps, resolveGridStep } from "../src/modules/payroll/payroll.grid";
import { evaluateGates } from "../src/modules/payroll/payroll.gates";
import { roundTo, daysInMonth, isValidMonth } from "../src/modules/payroll/payroll.money";
import type {
  PayrollEmployee,
  PayrollFormulaData,
  PayrollGridData,
  PayrollMetrics
} from "../src/modules/payroll/payroll.types";

const MONTH = "2026-10";

function agent(user_id = 11, kpi_group_ids: number[] = [5]): PayrollEmployee {
  return { user_id, fio: "Agent A", role: "agent", kpi_group_ids };
}

function formula(over: Partial<PayrollFormulaData> = {}): PayrollFormulaData {
  return {
    id: 1,
    name: "F",
    kind: "kpi_bonus",
    roles: ["agent"],
    kpi_group_id: null,
    base_amount: 2_000_000,
    config: {},
    components: [],
    gates: [],
    priority: 0,
    is_default: true,
    is_active: true,
    grid: null,
    ...over
  };
}

function metrics(over: Partial<PayrollMetrics> = {}): PayrollMetrics {
  return mergeMetrics(emptyMetrics(), {
    sales_sum: 100_000_000,
    sales_count: 40,
    plan_sum: 80_000_000,
    worked_days: 22,
    planned_days: 22,
    ...over
  });
}

function kpiGrid(over: Partial<PayrollGridData> = {}): PayrollGridData {
  return {
    id: 7,
    name: "Agent KPI сетка",
    kpi_group_id: 5,
    metric: "kpi_percent",
    mode: "coefficient",
    steps: [
      { month: null, from_value: 0, to_value: 80, coefficient: 0, amount: 0 },
      { month: null, from_value: 80, to_value: 100, coefficient: 0.5, amount: 0 },
      { month: null, from_value: 100, to_value: 120, coefficient: 1, amount: 0 },
      { month: null, from_value: 120, to_value: null, coefficient: 1.5, amount: 0 }
    ],
    ...over
  };
}

describe("payroll: formula tanlash (KPI guruh bog‘lanishi)", () => {
  it("guruhga bog‘langan formula faqat shu guruh xodimiga qo‘llanadi", () => {
    const grouped = formula({ id: 2, name: "KPI-5", kpi_group_id: 5, is_default: false });
    const fallback = formula({ id: 1, name: "Agent standart", kpi_group_id: null, is_default: true });

    const inGroup = resolveFormula(agent(11, [5]), [grouped, fallback], MONTH);
    expect(inGroup?.formula.id).toBe(2);
    expect(inGroup?.reason).toBe("kpi_group");

    const outOfGroup = resolveFormula(agent(12, [9]), [grouped, fallback], MONTH);
    expect(outOfGroup?.formula.id).toBe(1);
    expect(outOfGroup?.reason).toBe("role_default");

    const noGroup = resolveFormula(agent(13, []), [grouped, fallback], MONTH);
    expect(noGroup?.formula.id).toBe(1);
  });

  it("rol mos kelmasa formula tanlanmaydi", () => {
    const agentOnly = formula({ roles: ["agent"] });
    const supervisor: PayrollEmployee = { user_id: 21, fio: "SVR", role: "supervisor", kpi_group_ids: [5] };
    expect(resolveFormula(supervisor, [agentOnly], MONTH)).toBeNull();
  });

  it("bir nechta guruh formulasi bo‘lsa priority yuqorisi yutadi", () => {
    const low = formula({ id: 2, kpi_group_id: 5, priority: 1, is_default: false });
    const high = formula({ id: 3, kpi_group_id: 5, priority: 10, is_default: false });
    expect(resolveFormula(agent(11, [5]), [low, high], MONTH)?.formula.id).toBe(3);
  });

  it("neaktiv va muddati o‘tgan formula e’tiborga olinmaydi", () => {
    const inactive = formula({ id: 2, is_active: false });
    const expired = formula({ id: 3, valid_to: "2026-09-30" });
    const future = formula({ id: 4, valid_from: "2026-11-01" });
    const ok = formula({ id: 5, valid_from: "2026-01-01", valid_to: "2026-12-31" });

    expect(resolveFormula(agent(), [inactive, expired, future, ok], MONTH)?.formula.id).toBe(5);
    expect(resolveFormula(agent(), [inactive, expired, future], MONTH)).toBeNull();
  });

  it("hech qanday formula bo‘lmasa — hisob 0 va ogohlantirish", () => {
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics(),
      resolution: null
    });
    expect(row.net_amount).toBe(0);
    expect(row.warnings.join(" ")).toContain("Formula biriktirilmagan");
  });
});

describe("payroll: сетка bosqichlari", () => {
  it("baza qatorlar bo‘yicha bosqich tanlanadi", () => {
    const grid = kpiGrid();
    expect(resolveGridStep(grid, MONTH, 79)?.coefficient).toBe(0);
    expect(resolveGridStep(grid, MONTH, 80)?.coefficient).toBe(0.5);
    expect(resolveGridStep(grid, MONTH, 119)?.coefficient).toBe(1);
    expect(resolveGridStep(grid, MONTH, 250)?.coefficient).toBe(1.5);
    expect(pickGridSteps(grid, MONTH).length).toBe(4);
  });

  it("oylik сетка bo‘lsa — faqat oylik qatorlar ishlatiladi", () => {
    const grid = kpiGrid({
      steps: [
        { month: null, from_value: 0, to_value: null, coefficient: 1, amount: 0 },
        { month: MONTH, from_value: 0, to_value: 100, coefficient: 0.25, amount: 0 },
        { month: MONTH, from_value: 100, to_value: null, coefficient: 2, amount: 0 }
      ]
    });
    expect(pickGridSteps(grid, MONTH).length).toBe(2);
    expect(resolveGridStep(grid, MONTH, 50)?.coefficient).toBe(0.25);
    expect(resolveGridStep(grid, MONTH, 150)?.coefficient).toBe(2);
    // boshqa oy uchun oylik qatorlar ishlamaydi → baza
    expect(pickGridSteps(grid, "2026-11").length).toBe(1);
    expect(resolveGridStep(grid, "2026-11", 50)?.coefficient).toBe(1);
  });

  it("bosqichga tushmasa bonus 0 va izoh qaytadi", () => {
    const grid = kpiGrid({
      steps: [{ month: null, from_value: 90, to_value: 100, coefficient: 1, amount: 0 }]
    });
    expect(resolveGridStep(grid, MONTH, 50)).toBeNull();
  });

  it("plan bo‘lmasa — KPI сетка qo‘llanmaydi (ogohlantirish bilan)", () => {
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ plan_sum: 0 }),
      resolution: { formula: formula({ grid: kpiGrid() }), reason: "role_default" }
    });
    expect(row.variable_amount).toBe(0);
    expect(row.achievement_percent).toBeNull();
    expect(row.warnings.join(" ")).toContain("План не задан");
  });
});

describe("payroll: agent hisobi (kpi_bonus)", () => {
  it("oklad + сетка koeffitsiyenti (125% bajarilish → ×1.5)", () => {
    const m = metrics({ sales_sum: 100_000_000, plan_sum: 80_000_000 }); // 125%
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: m,
      resolution: { formula: formula({ base_amount: 2_000_000, grid: kpiGrid() }), reason: "kpi_group" }
    });
    expect(row.achievement_percent).toBe(125);
    expect(row.base_amount).toBe(2_000_000);
    expect(row.variable_amount).toBe(3_000_000);
    expect(row.net_amount).toBe(5_000_000);
  });

  it("setka bo‘lmasa config.percent ishlaydi", () => {
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics(),
      resolution: {
        formula: formula({ base_amount: 1_000_000, config: { percent: 30 } }),
        reason: "role_default"
      }
    });
    expect(row.variable_amount).toBe(300_000);
    expect(row.net_amount).toBe(1_300_000);
  });

  it("savdodan foiz (percent_sales) va qaytarilmaydigan qism", () => {
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ sales_sum: 50_000_000 }),
      resolution: {
        formula: formula({ kind: "percent_sales", base_amount: 0, config: { percent: 2 } }),
        reason: "role_default"
      }
    });
    expect(row.variable_amount).toBe(1_000_000);
    expect(row.base_amount).toBe(0);
    expect(row.net_amount).toBe(1_000_000);
  });

  it("shart bajarilsa bonus kesiladi (min zakaz soni)", () => {
    const f = formula({
      base_amount: 2_000_000,
      grid: kpiGrid(),
      gates: [{ metric: "sales_count", op: "lt", value: 20, effect: "zero_variable" }]
    });
    const blocked = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ sales_count: 10 }),
      resolution: { formula: f, reason: "kpi_group" }
    });
    expect(blocked.variable_amount).toBe(0);
    expect(blocked.net_amount).toBe(2_000_000);

    const passed = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ sales_count: 40 }),
      resolution: { formula: f, reason: "kpi_group" }
    });
    expect(passed.variable_amount).toBe(3_000_000);
  });

  it("shart `reduce_percent` — bonus qisman kesiladi", () => {
    const outcome = evaluateGates(
      [{ metric: "kpi_percent", op: "lt", value: 100, effect: "reduce_percent", reduce_percent: 50 }],
      metrics(),
      90
    );
    expect(outcome.multiplier).toBe(0.5);
    expect(outcome.blocked).toBe(false);
  });

  it("davomat proporsiyasi: 11/22 kun → oklad yarmi", () => {
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ worked_days: 11, planned_days: 22, plan_sum: 0 }),
      resolution: { formula: formula({ base_amount: 2_000_000 }), reason: "role_default" }
    });
    expect(row.base_amount).toBe(1_000_000);
    expect(row.net_amount).toBe(1_000_000);
  });

  it("ustama va ushlanmalar: fixed + percent_base", () => {
    const f = formula({
      base_amount: 2_000_000,
      components: [
        { code: "fuel", label: "Yoqilg‘i", kind: "allowance", mode: "fixed", value: 500_000 },
        { code: "seniority", label: "Staj", kind: "allowance", mode: "percent_base", value: 10 },
        { code: "fine", label: "Jarima", kind: "deduction", mode: "fixed", value: 200_000 }
      ]
    });
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ plan_sum: 0 }),
      resolution: { formula: f, reason: "role_default" }
    });
    expect(row.allowance_amount).toBe(700_000);
    expect(row.deduction_amount).toBe(200_000);
    expect(row.gross_amount).toBe(2_700_000);
    expect(row.net_amount).toBe(2_500_000);
  });

  it("qo‘lda kiritilgan tuzatish va manual_net", () => {
    const base = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ plan_sum: 0 }),
      resolution: { formula: formula({ base_amount: 1_000_000 }), reason: "role_default" },
      adjustments: [
        { code: "bonus_manual", label: "Qo‘shimcha", amount: 300_000 },
        { code: "advance", label: "Avans", amount: -100_000 }
      ]
    });
    expect(base.adjustment_amount).toBe(200_000);
    expect(base.net_amount).toBe(1_200_000);

    const manual = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ plan_sum: 0 }),
      resolution: { formula: formula({ base_amount: 1_000_000 }), reason: "role_default" },
      manual_net: 999_000
    });
    expect(manual.net_amount).toBe(999_000);
  });

  it("chegaralar (min_net / max_net) va yaxlitlash", () => {
    const row = computePayrollEntry({
      employee: agent(),
      month: MONTH,
      metrics: metrics({ plan_sum: 0 }),
      resolution: {
        formula: formula({ base_amount: 1_234_567, config: { max_net: 1_000_000, round_to: 1000 } }),
        reason: "role_default"
      }
    });
    expect(row.net_amount).toBe(1_000_000);
    expect(roundTo(1234, 100)).toBe(1200);
  });
});

describe("payroll: supervayzer (team_percent)", () => {
  it("jamoa savdosidan foiz + сетка", () => {
    const m = metrics({ team_sales_sum: 500_000_000, team_plan_sum: 400_000_000, team_headcount: 6 });
    const f = formula({
      id: 4,
      name: "SVR jamoa",
      kind: "team_percent",
      roles: ["supervisor"],
      base_amount: 3_000_000,
      config: { percent: 1 }
    });
    const row = computePayrollEntry({
      employee: { user_id: 31, fio: "SVR", role: "supervisor", kpi_group_ids: [] },
      month: MONTH,
      metrics: m,
      resolution: { formula: f, reason: "role_default" }
    });
    expect(row.variable_amount).toBe(5_000_000);
    expect(row.net_amount).toBe(8_000_000);
  });

  it("jamoa uchun сетка (team_plan_sum metrikasi)", () => {
    const grid: PayrollGridData = {
      id: 9,
      name: "SVR сетка",
      kpi_group_id: 5,
      metric: "team_sales_sum",
      mode: "percent",
      steps: [
        { month: null, from_value: 0, to_value: 300_000_000, coefficient: 1, amount: 0.5 },
        { month: null, from_value: 300_000_000, to_value: null, coefficient: 1, amount: 1.5 }
      ]
    };
    const row = computePayrollEntry({
      employee: { user_id: 32, fio: "SVR", role: "supervisor", kpi_group_ids: [5] },
      month: MONTH,
      metrics: metrics({ team_sales_sum: 400_000_000 }),
      resolution: {
        formula: formula({ id: 6, kind: "team_percent", roles: ["supervisor"], base_amount: 0, grid }),
        reason: "kpi_group"
      }
    });
    // mode=percent → baza jamoa savdosi (bonus_base_metric berilmagan)
    // 400 000 000 × 1.5% = 6 000 000
    expect(row.variable_amount).toBe(6_000_000);
    expect(row.net_amount).toBe(6_000_000);
  });
});

describe("payroll: ekspeditor / inkassator / omborchi", () => {
  it("per_delivery: yetkazish × stawka + inkassatsiyadan %", () => {
    const row = computePayrollEntry({
      employee: { user_id: 41, fio: "EXP", role: "expeditor", kpi_group_ids: [] },
      month: MONTH,
      metrics: metrics({ deliveries: 120, collection_sum: 200_000_000, plan_sum: 0 }),
      resolution: {
        formula: formula({
          kind: "per_delivery",
          roles: ["expeditor"],
          base_amount: 1_000_000,
          config: { rate_per_unit: 20_000, percent: 0.5 }
        }),
        reason: "role_default"
      }
    });
    // 120 × 20 000 = 2 400 000 ; 200 000 000 × 0.5% = 1 000 000
    expect(row.variable_amount).toBe(3_400_000);
    expect(row.net_amount).toBe(4_400_000);
  });

  it("per_collection: inkassatsiyadan % + to‘lovlar soni × stawka", () => {
    const row = computePayrollEntry({
      employee: { user_id: 42, fio: "INK", role: "collector", kpi_group_ids: [] },
      month: MONTH,
      metrics: metrics({ collection_sum: 300_000_000, collection_count: 90, plan_sum: 0 }),
      resolution: {
        formula: formula({
          kind: "per_collection",
          roles: ["collector"],
          base_amount: 0,
          config: { rate_per_unit: 10_000, percent: 0.3 }
        }),
        reason: "role_default"
      }
    });
    // 300 000 000 × 0.3% = 900 000 ; 90 × 10 000 = 900 000
    expect(row.variable_amount).toBe(1_800_000);
  });

  it("piece: operatsiya × stawka", () => {
    const row = computePayrollEntry({
      employee: { user_id: 43, fio: "SKL", role: "skladchik", kpi_group_ids: [] },
      month: MONTH,
      metrics: metrics({ warehouse_ops: 850, plan_sum: 0 }),
      resolution: {
        formula: formula({
          kind: "piece",
          roles: ["skladchik"],
          base_amount: 500_000,
          config: { rate_per_unit: 1_500 }
        }),
        reason: "role_default"
      }
    });
    expect(row.variable_amount).toBe(1_275_000);
    expect(row.net_amount).toBe(1_775_000);
  });

  it("per_visit: tashrif × stawka", () => {
    const row = computePayrollEntry({
      employee: { user_id: 44, fio: "MRCH", role: "merchandiser", kpi_group_ids: [] },
      month: MONTH,
      metrics: metrics({ visits: 210, plan_sum: 0 }),
      resolution: {
        formula: formula({
          kind: "per_visit",
          roles: ["merchandiser"],
          base_amount: 0,
          config: { rate_per_unit: 8_000 }
        }),
        reason: "role_default"
      }
    });
    expect(row.net_amount).toBe(1_680_000);
  });
});

describe("payroll: oylik jami", () => {
  it("har xil rollar bir oyda, jami va formulasizlar soni", () => {
    const employees: PayrollEmployee[] = [
      agent(11, [5]),
      agent(12, []),
      { user_id: 31, fio: "SVR", role: "supervisor", kpi_group_ids: [5] },
      { user_id: 43, fio: "SKL", role: "skladchik", kpi_group_ids: [] }
    ];
    const formulas: PayrollFormulaData[] = [
      formula({ id: 1, kpi_group_id: 5, is_default: false, base_amount: 2_000_000, grid: kpiGrid() }),
      formula({ id: 2, name: "Agent standart", base_amount: 1_500_000 }),
      formula({
        id: 3,
        name: "SVR",
        kind: "team_percent",
        roles: ["supervisor"],
        base_amount: 3_000_000,
        config: { percent: 1 }
      }),
      formula({
        id: 4,
        name: "Omborchi",
        kind: "piece",
        roles: ["skladchik"],
        base_amount: 500_000,
        config: { rate_per_unit: 1_500 }
      })
    ];

    const result = computePayrollMonth({
      month: MONTH,
      employees,
      formulas,
      metricsByUser: {
        11: metrics(),
        12: metrics({ sales_sum: 40_000_000, plan_sum: 80_000_000 }),
        31: metrics({ team_sales_sum: 200_000_000, plan_sum: 0 }),
        43: metrics({ warehouse_ops: 100, plan_sum: 0 })
      }
    });

    expect(result.totals.employees).toBe(4);
    expect(result.totals.without_formula).toBe(0);
    // 11: 2 000 000 + 3 000 000 = 5 000 000
    // 12: 50% bajarilish → koeff 0 → 1 500 000
    // 31: 3 000 000 + 2 000 000 = 5 000 000
    // 43: 500 000 + 150 000 = 650 000
    expect(result.totals.net_amount).toBe(12_150_000);
    expect(result.rows.find((r) => r.user_id === 11)?.net_amount).toBe(5_000_000);
    expect(result.rows.find((r) => r.user_id === 12)?.net_amount).toBe(1_500_000);
  });

  it("formulasi yo‘q xodim hisobga kiradi, lekin summa 0", () => {
    const result = computePayrollMonth({
      month: MONTH,
      employees: [{ user_id: 99, fio: "X", role: "driver", kpi_group_ids: [] }],
      formulas: [formula({ roles: ["agent"] })]
    });
    expect(result.totals.without_formula).toBe(1);
    expect(result.totals.net_amount).toBe(0);
  });
});

describe("payroll: yordamchilar", () => {
  it("oy uzunligi va validatsiya", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-10")).toBe(31);
    expect(isValidMonth("2026-10")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("")).toBe(false);
  });
});
