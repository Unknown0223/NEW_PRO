import type { FinancePeriodGranularity, FinancePeriodRow } from "@/components/dashboard/finance/types";

const MONTH_SHORT = [
  "Янв.",
  "Февр.",
  "Март",
  "Апр.",
  "Май",
  "Июнь",
  "Июль",
  "Авг.",
  "Сент.",
  "Окт.",
  "Нояб.",
  "Дек."
] as const;

function parseIsoDate(value: string): Date {
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addPeriod(date: Date, granularity: FinancePeriodGranularity): Date {
  if (granularity === "month") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }
  if (granularity === "week") {
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    return next;
  }
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function alignPeriodStart(date: Date, granularity: FinancePeriodGranularity): Date {
  if (granularity === "month") {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  if (granularity === "week") {
    const d = new Date(date);
    const mondayOffset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    return d;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatFinancePeriodLabel(period: string, granularity: FinancePeriodGranularity): string {
  const d = parseIsoDate(period);
  if (granularity === "month") {
    return MONTH_SHORT[d.getMonth()] ?? period;
  }
  if (granularity === "week") {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Bo‘sh kunlar/haftalar/oylar uchun 0 qiymatli nuqtalar — grafik uzluksiz bo‘ladi. */
export function fillFinancePeriodSeries(
  rows: FinancePeriodRow[],
  from: string,
  to: string,
  granularity: FinancePeriodGranularity
): FinancePeriodRow[] {
  const start = alignPeriodStart(parseIsoDate(from), granularity);
  const end = alignPeriodStart(parseIsoDate(to), granularity);
  const byKey = new Map(rows.map((r) => [r.period.slice(0, 10), r]));

  const out: FinancePeriodRow[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addPeriod(cursor, granularity)) {
    const key = toIsoDate(cursor);
    const hit = byKey.get(key);
    out.push(
      hit ?? {
        period: key,
        debt_sum: "0",
        payment_sum: "0"
      }
    );
    if (out.length > 180) break;
  }
  return out.length > 0 ? out : rows;
}
