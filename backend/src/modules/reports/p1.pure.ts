import type { P1Metric, P1MonthCol, P1Row } from "./p1.types";

/** Ruscha oy nomlari — Excel P1 shabloni bilan mos. */
const MONTH_RU = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек"
] as const;

export const P1_RETURN_ORDER_TYPES = ["return", "return_by_order", "partial_return"] as const;

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** To‘liq yil: «Фев 2025», «Фев 2026» — '25/'26 chalkashligisiz. */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_RU[month - 1]} ${year}`;
}

export function monthPeriodLabel(month: number): string {
  return MONTH_RU[month - 1] ?? String(month);
}

export function quarterKey(year: number, q: number): string {
  return `${year}-Q${q}`;
}

export function yearKey(year: number): string {
  return `${year}-Y`;
}

export function quarterLabel(year: number, q: number): string {
  return `${q} кв. ${year}`;
}

export function yearSummaryLabel(year: number): string {
  return `Итого ${year}`;
}

export function buildP1MonthColumns(year: number, compareYear: number): P1MonthCol[] {
  const cols: P1MonthCol[] = [];
  for (let m = 1; m <= 12; m++) {
    cols.push({
      key: monthKey(compareYear, m),
      year: compareYear,
      month: m,
      label: monthLabel(compareYear, m),
      kind: "month"
    });
    cols.push({
      key: monthKey(year, m),
      year,
      month: m,
      label: monthLabel(year, m),
      kind: "month"
    });
    if (m % 3 === 0) {
      const q = m / 3;
      cols.push({
        key: quarterKey(compareYear, q),
        year: compareYear,
        month: q,
        label: quarterLabel(compareYear, q),
        kind: "quarter"
      });
      cols.push({
        key: quarterKey(year, q),
        year,
        month: q,
        label: quarterLabel(year, q),
        kind: "quarter"
      });
    }
  }
  cols.push({
    key: yearKey(compareYear),
    year: compareYear,
    month: 0,
    label: yearSummaryLabel(compareYear),
    kind: "year"
  });
  cols.push({
    key: yearKey(year),
    year,
    month: 0,
    label: yearSummaryLabel(year),
    kind: "year"
  });
  return cols;
}

export function emptyMetric(): P1Metric {
  return { akb: 0, qty: "0", total: "0" };
}

export function addMetrics(a: P1Metric, b: P1Metric): P1Metric {
  return {
    akb: a.akb + b.akb,
    qty: String(Number(a.qty) + Number(b.qty)),
    total: String(Number(a.total) + Number(b.total))
  };
}

export function yoyRatio(cy: number, ly: number): number | null {
  if (!Number.isFinite(ly) || ly === 0) return null;
  if (!Number.isFinite(cy)) return null;
  return cy / ly - 1;
}

export function yoyForPair(cy: P1Metric | undefined, ly: P1Metric | undefined) {
  const c = cy ?? emptyMetric();
  const l = ly ?? emptyMetric();
  return {
    akb: yoyRatio(c.akb, l.akb),
    qty: yoyRatio(Number(c.qty), Number(l.qty)),
    total: yoyRatio(Number(c.total), Number(l.total))
  };
}

/** Excel shabloni: viloyat/jami AKB = mahsulot AKB yig‘indisi (unique emas). */
export function rollupCells(
  sources: Array<Record<string, P1Metric>>,
  keys: string[]
): Record<string, P1Metric> {
  const out: Record<string, P1Metric> = {};
  for (const key of keys) {
    let acc = emptyMetric();
    for (const src of sources) {
      if (src[key]) acc = addMetrics(acc, src[key]);
    }
    out[key] = acc;
  }
  return out;
}

export function attachYoy(
  cells: Record<string, P1Metric>,
  year: number,
  compareYear: number
): P1Row["yoy"] {
  const yoy: P1Row["yoy"] = {};
  for (let m = 1; m <= 12; m++) {
    const cyK = monthKey(year, m);
    const lyK = monthKey(compareYear, m);
    yoy[cyK] = yoyForPair(cells[cyK], cells[lyK]);
  }
  for (let q = 1; q <= 4; q++) {
    const cyK = quarterKey(year, q);
    const lyK = quarterKey(compareYear, q);
    yoy[cyK] = yoyForPair(cells[cyK], cells[lyK]);
  }
  yoy[yearKey(year)] = yoyForPair(cells[yearKey(year)], cells[yearKey(compareYear)]);
  return yoy;
}

export function fillQuarterAndYear(
  cells: Record<string, P1Metric>,
  years: number[]
): Record<string, P1Metric> {
  const out = { ...cells };
  for (const y of years) {
    for (let q = 1; q <= 4; q++) {
      const months = [q * 3 - 2, q * 3 - 1, q * 3].map((m) => monthKey(y, m));
      out[quarterKey(y, q)] = months.reduce(
        (acc, k) => addMetrics(acc, out[k] ?? emptyMetric()),
        emptyMetric()
      );
    }
    out[yearKey(y)] = [1, 2, 3, 4]
      .map((q) => quarterKey(y, q))
      .reduce((acc, k) => addMetrics(acc, out[k] ?? emptyMetric()), emptyMetric());
  }
  return out;
}

export function signedQtyFactor(orderType: string, status: string): number {
  if (status === "returned") return -1;
  if ((P1_RETURN_ORDER_TYPES as readonly string[]).includes(orderType)) return -1;
  return 1;
}
