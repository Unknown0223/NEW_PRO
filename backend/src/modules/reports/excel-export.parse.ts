import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { ExcelExportDateType, ExcelExportFilters } from "./excel-export.types";

export function parseExcelExportQuery(q: Record<string, string | undefined>): ExcelExportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const dtRaw = (q.date_type ?? "").trim();
  const date_type: ExcelExportDateType =
    dtRaw === "order_date" || dtRaw === "shipped_date" || dtRaw === "delivered_date" ? dtRaw : "shipped_date";
  return {
    date_type,
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    agent_ids: intList(q.agent_ids),
    expeditor_ids: intList(q.expeditor_ids),
    category_ids: intList(q.category_ids),
    product_ids: intList(q.product_ids),
    client_categories: strList(q.client_categories),
    statuses: strList(q.statuses),
    warehouse_ids: intList(q.warehouse_ids),
    price_types: strList(q.price_types),
    payment_methods: strList(q.payment_methods),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
