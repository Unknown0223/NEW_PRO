/**
 * ЗАРПЛАТА — rol bo‘yicha o‘zgaruvchan qism (bonus/foiz/stawka).
 *
 * Har bir `kind` alohida hisob usulini ifodalaydi:
 *  - `fixed`         → 0 (faqat oklad)
 *  - `percent_sales` → savdo summasidan foiz
 *  - `kpi_bonus`     → оклад + сетка (yoki config.percent) bo‘yicha bonus
 *  - `team_percent`  → jamoa savdosidan foiz (+ сетка)
 *  - `per_delivery`  → yetkazish × stawka + inkassatsiyadan foiz
 *  - `per_collection`→ inkassatsiyadan foiz + to‘lovlar soni × stawka
 *  - `per_visit`     → tashrif × stawka
 *  - `piece`         → operatsiya × stawka
 *
 * Сетка (`PayrollGrid`) faqat `kpi_bonus` va `team_percent` da qo‘llanadi.
 */
import { applyGrid, type GridApplication } from "./payroll.grid";
import { percentOf, round2 } from "./payroll.money";
import type {
  PayrollBreakdownLine,
  PayrollFormulaConfig,
  PayrollFormulaKind,
  PayrollGridData,
  PayrollMetricKey,
  PayrollMetrics
} from "./payroll.types";

export type StrategyInput = {
  kind: PayrollFormulaKind;
  config: PayrollFormulaConfig;
  metrics: PayrollMetrics;
  /** Davomatga proporsionallashtirilgan оклад. */
  baseAmount: number;
  achievement: number | null;
  month: string;
  grid?: PayrollGridData | null;
};

export type StrategyResult = {
  amount: number;
  lines: PayrollBreakdownLine[];
  warnings: string[];
};

const KIND_WITH_GRID: PayrollFormulaKind[] = ["kpi_bonus", "team_percent"];

/**
 * Bonus bazasi (сетка koeffitsiyenti/foizi nimaga qo‘llanadi):
 *  1. `config.bonus_base_is_oklad = true` → оклад.
 *  2. `config.bonus_base_metric` berilgan → shu metrika qiymati.
 *  3. `team_percent` → jamoa savdosi (default), `kpi_bonus` → ОКЛАД.
 */
export function bonusBaseFor(
  config: PayrollFormulaConfig,
  metrics: PayrollMetrics,
  ctx: { oklad: number; kind: PayrollFormulaKind }
): number {
  if (config.bonus_base_is_oklad === true) return ctx.oklad;
  if (config.bonus_base_metric) {
    const v = metrics[config.bonus_base_metric];
    if (Number.isFinite(v)) return v;
  }
  if (ctx.kind === "team_percent") {
    return metricValue(metrics, config.percent_metric ?? "team_sales_sum");
  }
  return ctx.oklad;
}

function metricValue(metrics: PayrollMetrics, key: PayrollMetricKey | undefined, fallback: number = 0): number {
  if (!key) return fallback;
  const v = metrics[key];
  return Number.isFinite(v) ? v : fallback;
}

function unitLines(
  label: string,
  units: number,
  rate: number
): { amount: number; lines: PayrollBreakdownLine[] } {
  const amount = round2(units * rate);
  if (amount === 0) return { amount: 0, lines: [] };
  return {
    amount,
    lines: [{ code: "unit_rate", label, amount, note: `${units} × ${rate}` }]
  };
}

function percentLines(
  label: string,
  base: number,
  percent: number,
  note: string
): { amount: number; lines: PayrollBreakdownLine[] } {
  const amount = percentOf(base, percent);
  if (amount === 0) return { amount: 0, lines: [] };
  return { amount, lines: [{ code: "percent", label, amount, note }] };
}

function merge(parts: Array<{ amount: number; lines: PayrollBreakdownLine[] }>): {
  amount: number;
  lines: PayrollBreakdownLine[];
} {
  let amount = 0;
  const lines: PayrollBreakdownLine[] = [];
  for (const p of parts) {
    amount += p.amount;
    lines.push(...p.lines);
  }
  return { amount: round2(amount), lines };
}

export function computeVariablePart(input: StrategyInput): StrategyResult {
  const { kind, config, metrics, baseAmount, achievement, month } = input;
  const warnings: string[] = [];

  if (kind === "fixed") {
    return { amount: 0, lines: [], warnings };
  }

  if (KIND_WITH_GRID.includes(kind)) {
    const bonusBase = bonusBaseFor(config, metrics, { oklad: baseAmount, kind });
    const applied: GridApplication = applyGrid({
      grid: input.grid ?? null,
      month,
      metrics,
      bonusBase,
      achievementPercent: achievement
    });
    if (applied.note) warnings.push(applied.note);

    if (input.grid) {
      return { amount: applied.amount, lines: applied.lines, warnings };
    }

    // Сетка biriktirilmagan → config.percent bo‘yicha
    const percent = Number.isFinite(config.percent) ? (config.percent as number) : 0;
    if (kind === "team_percent") {
      const teamBase = bonusBase;
      const p = percentLines("Jamoa savdosidan %", teamBase, percent, `${percent}% × ${teamBase}`);
      return { ...p, warnings };
    }
    const p = percentLines("Окладдан % (KPI)", bonusBase, percent, `${percent}% × ${bonusBase}`);
    return { ...p, warnings };
  }

  if (input.grid) {
    warnings.push(`«${kind}» hisob turi сеткani qo‘llab-quvvatlamaydi — сетка e’tiborga olinmadi`);
  }

  if (kind === "percent_sales") {
    const metric = config.percent_metric ?? "sales_sum";
    const base = metricValue(metrics, metric);
    const percent = Number.isFinite(config.percent) ? (config.percent as number) : 0;
    const p = percentLines("Savdodan %", base, percent, `${percent}% × ${metric}`);
    return { ...p, warnings };
  }

  if (kind === "per_delivery") {
    const units = metricValue(metrics, config.unit_metric ?? "deliveries");
    const rate = Number.isFinite(config.rate_per_unit) ? (config.rate_per_unit as number) : 0;
    const collection = metricValue(metrics, "collection_sum");
    const percent = Number.isFinite(config.percent) ? (config.percent as number) : 0;
    const r = merge([
      unitLines("Yetkazishlar uchun", units, rate),
      percentLines("Inkassatsiyadan %", collection, percent, `${percent}% × inkassatsiya`)
    ]);
    return { ...r, warnings };
  }

  if (kind === "per_collection") {
    const collection = metricValue(metrics, "collection_sum");
    const count = metricValue(metrics, "collection_count");
    const rate = Number.isFinite(config.rate_per_unit) ? (config.rate_per_unit as number) : 0;
    const percent = Number.isFinite(config.percent) ? (config.percent as number) : 0;
    const r = merge([
      percentLines("Inkassatsiyadan %", collection, percent, `${percent}% × inkassatsiya`),
      unitLines("To‘lovlar soni uchun", count, rate)
    ]);
    return { ...r, warnings };
  }

  if (kind === "per_visit") {
    const units = metricValue(metrics, config.unit_metric ?? "visits");
    const rate = Number.isFinite(config.rate_per_unit) ? (config.rate_per_unit as number) : 0;
    const r = unitLines("Tashriflar uchun", units, rate);
    return { ...r, warnings };
  }

  if (kind === "piece") {
    const units = metricValue(metrics, config.unit_metric ?? "warehouse_ops");
    const rate = Number.isFinite(config.rate_per_unit) ? (config.rate_per_unit as number) : 0;
    const r = unitLines("Bajarilgan operatsiyalar", units, rate);
    return { ...r, warnings };
  }

  warnings.push(`Noma’lum hisob turi: ${kind}`);
  return { amount: 0, lines: [], warnings };
}
