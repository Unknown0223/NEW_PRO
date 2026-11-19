import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { Sku3Filters } from "./sku-3.types";

const MAX_PRODUCTS = 40;

export function parseSku3Query(q: Record<string, string | undefined>): Sku3Filters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const product_ids = intList(q.product_ids).slice(0, MAX_PRODUCTS);
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    agent_ids: intList(q.agent_ids),
    expeditor_ids: intList(q.expeditor_ids),
    product_ids,
    price_types: strList(q.price_types),
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
