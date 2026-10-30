/** Konstruktor saqlangan hisobotini bot uchun bajariladigan spetsifikatsiyaga aylantirish. */

export type PivotAgg = "SUM" | "COUNT" | "AVG" | "MIN" | "MAX" | "COUNT_DISTINCT";
export type PivotValue = { field: string; agg: PivotAgg };

export type ReportSpec =
  | { kind: "legacy"; config: Record<string, unknown> }
  | { kind: "pivot"; filters: Record<string, unknown>; rows: string[]; values: PivotValue[] };

const AGG_SET = new Set<PivotAgg>(["SUM", "COUNT", "AVG", "MIN", "MAX", "COUNT_DISTINCT"]);

function normAgg(raw: unknown): PivotAgg {
  const s = String(raw ?? "SUM").toUpperCase().replace(/\s+/g, "_");
  if (s === "DISTINCTCOUNT" || s === "DISTINCT_COUNT") return "COUNT_DISTINCT";
  if (s === "AVERAGE") return "AVG";
  return AGG_SET.has(s as PivotAgg) ? (s as PivotAgg) : "SUM";
}

const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v);

/** `savdoDatasetFilters` yoki yuqori darajadagi dataset maydonlari. */
function datasetFilters(c: Record<string, unknown>): Record<string, unknown> {
  if (isObj(c.savdoDatasetFilters)) return { ...c.savdoDatasetFilters };
  const keys = ["datasetId", "dateMode", "dateFrom", "dateTo", "agentIds", "statuses", "orderTypes"];
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(c)) if (keys.includes(k) || k.endsWith("Ids") || k.endsWith("Values") || k.endsWith("Refs")) out[k] = c[k];
  return out;
}

export function extractReportSpec(config: unknown): ReportSpec | null {
  if (!isObj(config)) return null;
  if (isObj(config.salecPivotConfig)) {
    const p = config.salecPivotConfig;
    const rows = Array.isArray(p.rows) ? p.rows.map(String).filter(Boolean) : [];
    const values = Array.isArray(p.values)
      ? p.values.filter(isObj).map((v) => ({ field: String(v.fieldId ?? v.field ?? ""), agg: normAgg(v.aggregation) })).filter((v) => v.field)
      : [];
    return { kind: "pivot", filters: datasetFilters(config), rows, values };
  }
  if (isObj(config.dataSource) && isObj(config.slice)) {
    const s = config.slice;
    const rows = Array.isArray(s.rows)
      ? s.rows.filter(isObj).map((r) => String(r.uniqueName ?? "")).filter((u) => u && !u.startsWith("[Measures]"))
      : [];
    const values = Array.isArray(s.measures)
      ? s.measures.filter(isObj).map((m) => ({ field: String(m.uniqueName ?? ""), agg: normAgg(m.aggregation) })).filter((v) => v.field)
      : [];
    return { kind: "pivot", filters: datasetFilters(config), rows, values };
  }
  if (typeof config.datasetId === "string") return { kind: "legacy", config: { ...config } };
  return null;
}

/** Saqlangan davr (YYYY-MM-DD) — «saqlangandek» varianti uchun. */
export function savedPeriod(spec: ReportSpec): { from: string; to: string } | null {
  const src = spec.kind === "legacy" ? spec.config : spec.filters;
  const from = String(src.dateFrom ?? "").slice(0, 10);
  const to = String(src.dateTo ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) ? { from, to } : null;
}

export function withPeriod(spec: ReportSpec, from: string, to: string): ReportSpec {
  if (spec.kind === "legacy") return { ...spec, config: { ...spec.config, dateFrom: from, dateTo: to } };
  return { ...spec, filters: { datasetId: "orders_sales_lines", dateMode: "order_date", ...spec.filters, dateFrom: from, dateTo: to } };
}

export type PivotGroup = { keys: string[]; values: number[] };
export type PivotResult = { groups: PivotGroup[]; totals: number[]; rowCount: number };

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type Acc = { sum: number; count: number; min: number; max: number; distinct: Set<string> };
const newAcc = (): Acc => ({ sum: 0, count: 0, min: Infinity, max: -Infinity, distinct: new Set() });

function feed(a: Acc, raw: unknown) {
  if (raw == null || raw === "") return;
  const n = toNum(raw);
  a.sum += n;
  a.count += 1;
  a.min = Math.min(a.min, n);
  a.max = Math.max(a.max, n);
  if (a.distinct.size < 100_000) a.distinct.add(String(raw));
}

function finish(a: Acc, agg: PivotAgg): number {
  switch (agg) {
    case "COUNT":
      return a.count;
    case "COUNT_DISTINCT":
      return a.distinct.size;
    case "AVG":
      return a.count ? a.sum / a.count : 0;
    case "MIN":
      return a.count ? a.min : 0;
    case "MAX":
      return a.count ? a.max : 0;
    default:
      return a.sum;
  }
}

/** Qator maydonlari bo'yicha guruhlash; birinchi qiymat bo'yicha kamayish tartibida. */
export function pivotAggregate(rows: Array<Record<string, unknown>>, rowFields: string[], values: PivotValue[]): PivotResult {
  const vals = values.length > 0 ? values : [{ field: "__count", agg: "COUNT" as PivotAgg }];
  const map = new Map<string, { keys: string[]; accs: Acc[] }>();
  const totals = vals.map(() => newAcc());
  for (const r of rows) {
    const keys = rowFields.map((f) => (r[f] == null || r[f] === "" ? "—" : String(r[f])));
    const k = keys.join("\u0001");
    let g = map.get(k);
    if (!g) {
      g = { keys, accs: vals.map(() => newAcc()) };
      map.set(k, g);
    }
    vals.forEach((v, i) => {
      const raw = v.field === "__count" ? 1 : r[v.field];
      feed(g!.accs[i], raw);
      feed(totals[i], raw);
    });
  }
  const groups = [...map.values()]
    .map((g) => ({ keys: g.keys, values: g.accs.map((a, i) => finish(a, vals[i].agg)) }))
    .sort((a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0));
  return { groups, totals: totals.map((a, i) => finish(a, vals[i].agg)), rowCount: rows.length };
}
