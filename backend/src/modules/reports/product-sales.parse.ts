import type { ProductSalesReportFilters } from "./product-sales.types";
import { intList, parseOrderTypesParam, strList } from "./product-sales.helpers";

export function parseProductSalesReportQuery(q: Record<string, string | undefined>): ProductSalesReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = (q.from ?? "").trim() || defaultFrom;
  const to = (q.to ?? "").trim() || defaultTo;
  const dt =
    q.date_type === "shipped_date" || q.date_type === "delivered_date" ? q.date_type : "order_date";
  const sortRaw = (q.sort_by ?? "").trim().toLowerCase();
  const sort_by: ProductSalesReportFilters["sort_by"] =
    sortRaw === "total" ? "total" : sortRaw === "qty" ? "qty" : "name";
  const cons =
    q.consignment === "yes" || q.consignment === "no" ? (q.consignment as "yes" | "no") : "all";
  const wid = q.warehouse_id?.trim();
  const warehouse_id = wid ? Number.parseInt(wid, 10) : undefined;
  return {
    date_type: dt,
    from,
    to,
    statuses: strList(q.statuses),
    order_types: parseOrderTypesParam(q.order_types),
    category_ids: intList(q.category_ids),
    product_ids: intList(q.product_ids),
    product_group_ids: intList(q.product_group_ids),
    segment_ids: intList(q.segment_ids),
    price_types: strList(q.price_types),
    supervisor_ids: intList(q.supervisor_ids),
    agent_ids: intList(q.agent_ids),
    trade_direction_ids: intList(q.trade_direction_ids),
    payment_methods: strList(q.payment_methods),
    warehouse_id: Number.isFinite(warehouse_id) && warehouse_id! > 0 ? warehouse_id : undefined,
    active_only: q.active_only === "1" || q.active_only === "true" || q.active_only === "yes",
    paid_orders_only:
      q.paid_orders_only === "1" || q.paid_orders_only === "true" || q.paid_orders_only === "yes",
    brand_ids: intList(q.brand_ids),
    consignment: cons,
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit,
    sort_by
  };
}
