/**
 * ЗАРПЛАТА — UI yordamchilari (sof mantiq, test qilinadi).
 */
import { formatGroupedDecimal } from "@/lib/format-numbers";
import { PAYROLL_KIND_LABEL_RU } from "./payroll-api";
import type {
  PayrollCalcTotals,
  PayrollEntryRow,
  PayrollFormulaConfigDto,
  PayrollFormulaRow,
  PayrollGridRow,
  PayrollGridStep
} from "./payroll-api";

const MONTH_LABEL_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

/** So‘m: minglik ajratuvchi bilan, kasrsiz. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return formatGroupedDecimal(Number(value), 0);
}

/** Foiz: 12.5 → "12,5%". */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${formatGroupedDecimal(Number(value), digits)}%`;
}

/** `2026-10` → `Октябрь 2026`. */
export function monthLabel(month: string | null | undefined): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return "—";
  const [y, m] = month.split("-").map((x) => Number.parseInt(x, 10));
  const name = MONTH_LABEL_RU[(m ?? 1) - 1];
  return name ? `${name} ${y}` : month;
}

/** Joriy oy (YYYY-MM). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Oxirgi N oy ro‘yxati (yangi → eski). */
export function recentMonths(count = 12, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function kindLabel(kind: string | null | undefined): string {
  return PAYROLL_KIND_LABEL_RU[kind ?? ""] ?? kind ?? "—";
}

/** Formula parametrlarini qisqa matnga aylantirish (jadval/tooltip). */
export function formulaConfigSummary(kind: string, config: PayrollFormulaConfigDto | null | undefined): string {
  const c = config ?? {};
  const parts: string[] = [];
  if (Number.isFinite(c.percent)) parts.push(`${formatGroupedDecimal(Number(c.percent), 2)}%`);
  if (Number.isFinite(c.rate_per_unit)) parts.push(`${formatMoney(c.rate_per_unit)} / birlik`);
  if (c.percent_metric) parts.push(`база: ${c.percent_metric}`);
  if (c.unit_metric) parts.push(`birlik: ${c.unit_metric}`);
  if (c.attendance_prorate && c.attendance_prorate !== "base") {
    parts.push(c.attendance_prorate === "none" ? "davomat hisobga olinmaydi" : "davomat × hammasi");
  }
  if (Number.isFinite(c.max_net)) parts.push(`maks: ${formatMoney(c.max_net)}`);
  if (parts.length === 0) return kind === "fixed" ? "faqat oklad" : "—";
  return parts.join(" · ");
}

/** Formulaning to‘liq tavsifi (dialog / jadval izohi). */
export function formulaSummary(formula: Pick<PayrollFormulaRow, "kind" | "base_amount" | "grid_name" | "config">): string {
  const base = formula.base_amount > 0 ? `Оклад ${formatMoney(formula.base_amount)}` : "";
  const grid = formula.grid_name ? `сетка «${formula.grid_name}»` : "";
  const cfg = formulaConfigSummary(formula.kind, formula.config);
  return [base, grid, cfg].filter(Boolean).join(" + ") || kindLabel(formula.kind);
}

/** Сетка bosqichini matn qilib ko‘rsatish. */
export function gridStepSummary(mode: string, step: PayrollGridStep): string {
  const range = `${step.from_value == null ? "−∞" : formatMoney(step.from_value)} … ${
    step.to_value == null ? "+∞" : formatMoney(step.to_value)
  }`;
  const result =
    mode === "coefficient"
      ? `×${formatGroupedDecimal(step.coefficient, 2)}`
      : mode === "percent"
        ? `${formatGroupedDecimal(step.amount, 2)}%`
        : formatMoney(step.amount);
  return `${range} → ${result}`;
}

/** Jadval jami qatori uchun yig‘indi. */
export function calcTotalsFromRows(rows: PayrollEntryRow[]): PayrollCalcTotals {
  const sum = (pick: (r: PayrollEntryRow) => number) =>
    Math.round(rows.reduce((acc, r) => acc + (Number.isFinite(pick(r)) ? pick(r) : 0), 0) * 100) / 100;
  return {
    employees: rows.length,
    without_formula: rows.filter((r) => !r.formula_id).length,
    base_amount: sum((r) => r.base_amount),
    variable_amount: sum((r) => r.variable_amount),
    allowance_amount: sum((r) => r.allowance_amount),
    deduction_amount: sum((r) => r.deduction_amount),
    adjustment_amount: sum((r) => r.adjustment_amount),
    gross_amount: sum((r) => r.gross_amount),
    net_amount: sum((r) => r.net_amount)
  };
}

/** Qolgan summa (hisob − to‘langan). */
export function remainingAmount(net: number, paid: number): number {
  return Math.round(((Number.isFinite(net) ? net : 0) - (Number.isFinite(paid) ? paid : 0)) * 100) / 100;
}

/** KPI bajarilishi bo‘yicha rang (badge) sinfi. */
export function achievementTone(percent: number | null | undefined): "good" | "warn" | "bad" | "muted" {
  if (percent == null || !Number.isFinite(Number(percent))) return "muted";
  const v = Number(percent);
  if (v >= 100) return "good";
  if (v >= 80) return "warn";
  return "bad";
}

/** Rol nomini UI uchun (backend katalogidan; topilmasa — xom qiymat). */
export function roleLabel(role: string | null | undefined, roles: Array<{ role: string; label: string }>): string {
  const key = (role ?? "").trim();
  if (!key) return "—";
  return roles.find((r) => r.role === key)?.label ?? key;
}

/** Сетка qatorlarini saralash: baza avval, keyin oylik; `from_value` bo‘yicha. */
export function sortGridSteps(steps: PayrollGridStep[]): PayrollGridStep[] {
  return [...steps].sort((a, b) => {
    if ((a.month ?? "") !== (b.month ?? "")) return (a.month ?? "").localeCompare(b.month ?? "");
    const af = a.from_value ?? Number.NEGATIVE_INFINITY;
    const bf = b.from_value ?? Number.NEGATIVE_INFINITY;
    return af - bf;
  });
}
