/**
 * ЗАРПЛАТА — «Сетка» (bosqichli tarif jadvali).
 *
 * Qoidalar:
 *  1. `month = null` qatorlar — doimiy (baza) сетка.
 *  2. `month = "2026-10"` qatorlar — **oylik сетка**; agar berilgan oy uchun
 *     kamida bitta qator bo‘lsa, faqat shu qatorlar ishlatiladi (baza e’tiborga olinmaydi).
 *  3. Bosqich: `from_value ≤ value < to_value`. Chegara `null` = ochiq.
 *  4. Mos qator topilmasa — сетка bonus bermaydi (0), lekin hisob to‘xtamaydi.
 */
import { round2 } from "./payroll.money";
import type {
  PayrollBreakdownLine,
  PayrollGridData,
  PayrollGridMode,
  PayrollGridStep,
  PayrollMetricKey,
  PayrollMetrics
} from "./payroll.types";

/** Oy uchun ishlatiladigan qatorlar to‘plami (oylik > baza). */
export function pickGridSteps(grid: PayrollGridData, month: string): PayrollGridStep[] {
  const monthly = grid.steps.filter((s) => s.month === month);
  const chosen = monthly.length > 0 ? monthly : grid.steps.filter((s) => !s.month);
  return [...chosen].sort((a, b) => {
    const af = a.from_value ?? Number.NEGATIVE_INFINITY;
    const bf = b.from_value ?? Number.NEGATIVE_INFINITY;
    if (af !== bf) return af - bf;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export function isMonthlyGridUsed(grid: PayrollGridData, month: string): boolean {
  return grid.steps.some((s) => s.month === month);
}

/** Qiymat bo‘yicha bosqich tanlash. */
export function resolveGridStep(
  grid: PayrollGridData,
  month: string,
  value: number
): PayrollGridStep | null {
  if (!Number.isFinite(value)) return null;
  for (const step of pickGridSteps(grid, month)) {
    const fromOk = step.from_value == null || value >= step.from_value;
    const toOk = step.to_value == null || value < step.to_value;
    if (fromOk && toOk) return step;
  }
  return null;
}

/** Сетка qaysi ko‘rsatkichni o‘lchaydi. `kpi_percent` — hisoblangan bajarilish foizi. */
export function gridMetricValue(
  grid: Pick<PayrollGridData, "metric">,
  metrics: PayrollMetrics,
  achievementPercent: number | null
): number | null {
  if (grid.metric === "kpi_percent") return achievementPercent;
  const v = metrics[grid.metric as PayrollMetricKey];
  return Number.isFinite(v) ? v : null;
}

/** Bajarilish foizi: plan bo‘yicha (`plan_sum`), plan bo‘lmasa — `null`. */
export function achievementPercent(metrics: PayrollMetrics): number | null {
  const plan = metrics.plan_sum ?? 0;
  if (!Number.isFinite(plan) || plan <= 0) return null;
  return round2(((metrics.sales_sum ?? 0) / plan) * 100);
}

export type GridApplication = {
  amount: number;
  coefficient: number | null;
  step: PayrollGridStep | null;
  lines: PayrollBreakdownLine[];
  note: string | null;
};

/**
 * Сеткани qo‘llash: bosqich topilib, `mode` bo‘yicha summa hisoblanadi.
 *
 * - `coefficient` → `bonusBase × coefficient`
 * - `amount`      → qat’iy summa
 * - `percent`     → `bonusBase × amount / 100`
 */
export function applyGrid(input: {
  grid: PayrollGridData | null | undefined;
  month: string;
  metrics: PayrollMetrics;
  bonusBase: number;
  achievementPercent: number | null;
}): GridApplication {
  const { grid, month, metrics, bonusBase, achievementPercent: achievement } = input;
  const empty: GridApplication = {
    amount: 0,
    coefficient: null,
    step: null,
    lines: [],
    note: null
  };
  if (!grid) return empty;

  const metricValue = gridMetricValue(grid, metrics, achievement);
  if (metricValue == null) {
    return {
      ...empty,
      note:
        grid.metric === "kpi_percent"
          ? "План не задан — сетка KPI не применена"
          : `Нет данных по показателю «${grid.metric}»`
    };
  }

  const step = resolveGridStep(grid, month, metricValue);
  if (!step) {
    return { ...empty, note: `Значение ${formatMetric(metricValue)} не попало ни в один шаг сетки` };
  }

  const mode: PayrollGridMode = grid.mode;
  let amount = 0;
  if (mode === "coefficient") amount = round2(bonusBase * step.coefficient);
  else if (mode === "percent") amount = round2((bonusBase * step.amount) / 100);
  else amount = round2(step.amount);

  return {
    amount,
    coefficient: mode === "coefficient" ? step.coefficient : null,
    step,
    lines: [
      {
        code: `grid_${grid.id}`,
        label: `Сетка: ${grid.name}`,
        amount,
        note: describeStep(grid, month, metricValue, step)
      }
    ],
    note: null
  };
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function describeStep(
  grid: PayrollGridData,
  month: string,
  metricValue: number,
  step: PayrollGridStep
): string {
  const scope = step.month ? `oylik ${step.month}` : month ? `baza (${month})` : "baza";
  const range = `${step.from_value ?? "−∞"} … ${step.to_value ?? "+∞"}`;
  const result =
    grid.mode === "coefficient"
      ? `k=${step.coefficient}`
      : grid.mode === "percent"
        ? `${step.amount}%`
        : `${step.amount}`;
  return `${grid.metric}=${formatMetric(metricValue)} → ${range} [${scope}] → ${result}`;
}
