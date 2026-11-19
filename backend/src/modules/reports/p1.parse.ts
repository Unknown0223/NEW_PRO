import type { P1DateType, P1ReportFilters } from "./p1.types";

function intList(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function strList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const DATE_TYPES: readonly P1DateType[] = ["order_date", "shipped_date", "delivered_date"];

export function parseP1ReportQuery(q: Record<string, string | undefined>): P1ReportFilters {
  const nowY = new Date().getFullYear();
  const yearRaw = q.year?.trim();
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : nowY;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new Error("year must be 2000..2100");
  }
  const compareRaw = q.compare_year?.trim();
  const compare_year = compareRaw ? Number.parseInt(compareRaw, 10) : year - 1;
  if (!Number.isFinite(compare_year) || compare_year < 2000 || compare_year > 2100) {
    throw new Error("compare_year must be 2000..2100");
  }
  if (compare_year === year) {
    throw new Error("compare_year must differ from year");
  }
  const dateRaw = (q.date_type?.trim() || "order_date") as P1DateType;
  const date_type = DATE_TYPES.includes(dateRaw) ? dateRaw : "order_date";

  return {
    year,
    compare_year,
    date_type,
    trade_direction_ids: intList(q.trade_direction_ids),
    product_ids: intList(q.product_ids),
    brand_ids: intList(q.brand_ids),
    territory_1_list: strList(q.territory_1),
    territory_2_list: strList(q.territory_2),
    search: q.search?.trim() || undefined
  };
}
