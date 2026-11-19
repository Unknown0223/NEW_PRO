import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { PricesReportFilters } from "./prices-report.types";

export function parsePricesReportQuery(q: Record<string, string | undefined>): PricesReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    price_types: strList(q.price_types),
    category_ids: intList(q.category_ids),
    brand_ids: intList(q.brand_ids),
    product_ids: intList(q.product_ids),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
