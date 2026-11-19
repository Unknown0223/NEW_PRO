import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { ShelfReturnsDateType, ShelfReturnsFilters } from "./shelf-returns.types";

export function parseShelfReturnsQuery(q: Record<string, string | undefined>): ShelfReturnsFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const from = (q.from ?? "").trim() || defaultFrom;
  const to = (q.to ?? "").trim() || defaultTo;
  const dtRaw = (q.date_type ?? "").trim();
  const date_type: ShelfReturnsDateType =
    dtRaw === "order_date" || dtRaw === "shipped_date" || dtRaw === "delivered_date"
      ? dtRaw
      : "shipped_date";

  return {
    date_type,
    from,
    to,
    agent_ids: intList(q.agent_ids),
    expeditor_ids: intList(q.expeditor_ids),
    category_ids: intList(q.category_ids),
    client_categories: strList(q.client_categories),
    payment_methods: strList(q.payment_methods),
    price_types: strList(q.price_types),
    statuses: strList(q.statuses),
    warehouse_ids: intList(q.warehouse_ids),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
