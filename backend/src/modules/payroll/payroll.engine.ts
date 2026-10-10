/**
 * ЗАРПЛАТА — hisob engine (sof mantiq).
 *
 * Zanjir:
 *   1. `resolveFormula`  — xodim roli + KPI guruhiga mos formulani tanlaydi.
 *   2. `computePayrollEntry` — bitta xodim uchun oylik hisob.
 *   3. `computePayrollMonth` — butun oy + jami.
 *
 * Asosiy qoida: `kpi_group_id` to‘ldirilgan formula FAQAT shu guruhga
 * bog‘langan xodimlarga qo‘llanadi (`KpiGroupAgent`). Guruhga bog‘lanmagan
 * formula (`null`) — rol bo‘yicha zaxira.
 */
import { applyAdjustments, applyComponents } from "./payroll.components";
import { evaluateGates } from "./payroll.gates";
import { achievementPercent } from "./payroll.grid";
import { clamp01, daysInMonth, round2, roundTo, sumAmounts } from "./payroll.money";
import { computeVariablePart } from "./payroll.strategies";
import type {
  PayrollAdjustment,
  PayrollBreakdownLine,
  PayrollEmployee,
  PayrollEntryResult,
  PayrollFormulaData,
  PayrollMetrics,
  PayrollMetricKey,
  PayrollMonthResult
} from "./payroll.types";

export function emptyMetrics(): PayrollMetrics {
  return {
    sales_sum: 0,
    sales_count: 0,
    sales_volume: 0,
    returns_sum: 0,
    new_clients: 0,
    active_clients: 0,
    visits: 0,
    collection_sum: 0,
    collection_count: 0,
    deliveries: 0,
    warehouse_ops: 0,
    audits_count: 0,
    plan_sum: 0,
    plan_count: 0,
    plan_volume: 0,
    worked_days: 0,
    planned_days: 0,
    absent_days: 0,
    team_sales_sum: 0,
    team_plan_sum: 0,
    team_headcount: 0,
    debt_sum: 0
  };
}

/** Metrikalarni birlashtirish (partial → to‘liq). */
export function mergeMetrics(...parts: Array<Partial<PayrollMetrics> | null | undefined>): PayrollMetrics {
  const base = emptyMetrics();
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      const key = k as PayrollMetricKey;
      const n = Number(v);
      if (Number.isFinite(n)) base[key] = n;
    }
  }
  return base;
}

export type FormulaResolution = {
  formula: PayrollFormulaData;
  /** Tanlanish sababi (traceability). */
  reason: "kpi_group" | "role_default" | "role_any";
};

function formulaMatchesRole(formula: PayrollFormulaData, role: string): boolean {
  if (!formula.roles || formula.roles.length === 0) return true;
  return formula.roles.includes(role);
}

function formulaActiveInMonth(formula: PayrollFormulaData, month: string): boolean {
  if (!formula.is_active) return false;
  const from = formula.valid_from ?? null;
  const to = formula.valid_to ?? null;
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  if (from && from.slice(0, 10) > monthEnd) return false;
  if (to && to.slice(0, 10) < monthStart) return false;
  return true;
}

function byPriority(a: PayrollFormulaData, b: PayrollFormulaData): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.id - b.id;
}

/**
 * Xodim uchun formula tanlash.
 * 1) KPI guruhiga bog‘langan (xodim shu guruhda bo‘lsa) — eng yuqori priority.
 * 2) Rol bo‘yicha `is_default` formula (guruhga bog‘lanmagan).
 * 3) Guruhga bog‘lanmagan istalgan formula.
 */
export function resolveFormula(
  employee: PayrollEmployee,
  formulas: PayrollFormulaData[],
  month: string
): FormulaResolution | null {
  const active = formulas.filter((f) => formulaActiveInMonth(f, month));
  const forRole = active.filter((f) => formulaMatchesRole(f, employee.role));

  const groupIds = new Set(employee.kpi_group_ids ?? []);
  const grouped = forRole
    .filter((f) => f.kpi_group_id != null && groupIds.has(f.kpi_group_id))
    .sort(byPriority);
  if (grouped.length > 0) return { formula: grouped[0], reason: "kpi_group" };

  const roleDefault = forRole.filter((f) => f.kpi_group_id == null && f.is_default).sort(byPriority);
  if (roleDefault.length > 0) return { formula: roleDefault[0], reason: "role_default" };

  const anyRole = forRole.filter((f) => f.kpi_group_id == null).sort(byPriority);
  if (anyRole.length > 0) return { formula: anyRole[0], reason: "role_any" };

  return null;
}

export type ComputeEntryInput = {
  employee: PayrollEmployee;
  month: string;
  metrics: PayrollMetrics;
  resolution: FormulaResolution | null;
  /** Xodimning individual okladi (assignment) — formuladagi okladni ustidan yozadi. */
  base_override?: number | null;
  adjustments?: PayrollAdjustment[];
  manual_net?: number | null;
};

export function computePayrollEntry(input: ComputeEntryInput): PayrollEntryResult {
  const { employee, month, metrics, resolution } = input;
  const warnings: string[] = [];

  if (!resolution) {
    warnings.push("Formula biriktirilmagan: rol va KPI guruhiga mos faol formula topilmadi");
    return {
      user_id: employee.user_id,
      formula_id: null,
      formula_name: null,
      kind: "fixed",
      kpi_group_id: null,
      base_amount: 0,
      variable_amount: 0,
      allowance_amount: 0,
      deduction_amount: 0,
      adjustment_amount: 0,
      gross_amount: 0,
      net_amount: 0,
      worked_days: metrics.worked_days ?? 0,
      planned_days: metrics.planned_days ?? 0,
      achievement_percent: achievementPercent(metrics),
      breakdown: [],
      warnings
    };
  }

  const { formula } = resolution;
  const config = formula.config ?? {};
  const breakdown: PayrollBreakdownLine[] = [];

  const oklad =
    input.base_override != null && Number.isFinite(input.base_override)
      ? round2(input.base_override)
      : round2(formula.base_amount ?? 0);

  const worked = Number.isFinite(metrics.worked_days) ? metrics.worked_days : 0;
  const planned = Number.isFinite(metrics.planned_days) && metrics.planned_days > 0 ? metrics.planned_days : 0;
  const factor = planned > 0 ? clamp01(worked / planned) : 1;

  const prorate = config.attendance_prorate ?? "base";
  let base = prorate === "none" ? oklad : round2(oklad * factor);
  if (base !== oklad) {
    breakdown.push({
      code: "attendance",
      label: "Davomat koeffitsiyenti",
      amount: 0,
      note: `${worked}/${planned || "—"} kun → ×${factor.toFixed(2)}`
    });
  }

  const achievement = achievementPercent(metrics);
  const variableRaw = computeVariablePart({
    kind: formula.kind,
    config,
    metrics,
    baseAmount: base,
    achievement,
    month,
    grid: formula.grid ?? null
  });
  warnings.push(...variableRaw.warnings);
  breakdown.push(...variableRaw.lines);

  const gates = evaluateGates(formula.gates, metrics, achievement);
  warnings.push(...gates.warnings);
  breakdown.push(...gates.lines);

  let variable = round2(variableRaw.amount * gates.multiplier);
  if (prorate === "all" && planned > 0) variable = round2(variable * factor);
  if (variable !== 0) {
    breakdown.push({ code: "variable_total", label: "O‘zgaruvchan qism", amount: variable });
  }

  const grossBeforeComponents = sumAmounts([base, variable]);
  const components = applyComponents(formula.components, { base, gross: grossBeforeComponents });
  breakdown.push(...components.lines);

  const adjustments = applyAdjustments(input.adjustments);
  breakdown.push(...adjustments.lines);

  const gross = sumAmounts([base, variable, components.allowance]);
  let net = sumAmounts([gross, -components.deduction, adjustments.adjustment]);

  if (Number.isFinite(config.max_net) && net > (config.max_net as number)) {
    warnings.push(`Maksimal chegaraga yetdi: ${config.max_net}`);
    net = round2(config.max_net as number);
  }
  if (Number.isFinite(config.min_net) && net < (config.min_net as number)) {
    warnings.push(`Minimal chegaraga yetdi: ${config.min_net}`);
    net = round2(config.min_net as number);
  }

  net = roundTo(net, config.round_to);

  if (input.manual_net != null && Number.isFinite(input.manual_net)) {
    breakdown.push({
      code: "manual_net",
      label: "Qo‘lda kiritilgan summa",
      amount: round2(input.manual_net) - net,
      note: `Avvalgi hisob: ${net}`
    });
    net = round2(input.manual_net);
  }

  return {
    user_id: employee.user_id,
    formula_id: formula.id,
    formula_name: formula.name,
    kind: formula.kind,
    kpi_group_id: formula.kpi_group_id,
    base_amount: base,
    variable_amount: variable,
    allowance_amount: components.allowance,
    deduction_amount: components.deduction,
    adjustment_amount: adjustments.adjustment,
    gross_amount: gross,
    net_amount: net,
    worked_days: worked,
    planned_days: planned,
    achievement_percent: achievement,
    breakdown,
    warnings
  };
}

export type ComputeMonthInput = {
  month: string;
  employees: PayrollEmployee[];
  formulas: PayrollFormulaData[];
  metricsByUser?: Record<number, PayrollMetrics | Partial<PayrollMetrics>>;
  adjustmentsByUser?: Record<number, PayrollAdjustment[]>;
  baseOverrideByUser?: Record<number, number | null>;
  manualNetByUser?: Record<number, number | null>;
};

export function computePayrollMonth(input: ComputeMonthInput): PayrollMonthResult {
  const rows: PayrollEntryResult[] = [];
  let withoutFormula = 0;

  for (const employee of input.employees) {
    const metrics = mergeMetrics(input.metricsByUser?.[employee.user_id] as PayrollMetrics | undefined);
    const resolution = resolveFormula(employee, input.formulas, input.month);
    if (!resolution) withoutFormula += 1;

    rows.push(
      computePayrollEntry({
        employee,
        month: input.month,
        metrics,
        resolution,
        base_override: input.baseOverrideByUser?.[employee.user_id] ?? null,
        adjustments: input.adjustmentsByUser?.[employee.user_id] ?? [],
        manual_net: input.manualNetByUser?.[employee.user_id] ?? null
      })
    );
  }

  rows.sort((a, b) => a.user_id - b.user_id);

  return {
    month: input.month,
    rows,
    totals: {
      employees: rows.length,
      without_formula: withoutFormula,
      base_amount: sumAmounts(rows.map((r) => r.base_amount)),
      variable_amount: sumAmounts(rows.map((r) => r.variable_amount)),
      allowance_amount: sumAmounts(rows.map((r) => r.allowance_amount)),
      deduction_amount: sumAmounts(rows.map((r) => r.deduction_amount)),
      adjustment_amount: sumAmounts(rows.map((r) => r.adjustment_amount)),
      gross_amount: sumAmounts(rows.map((r) => r.gross_amount)),
      net_amount: sumAmounts(rows.map((r) => r.net_amount))
    }
  };
}
