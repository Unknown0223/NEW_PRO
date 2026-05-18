import type { ClientSales4Filters } from "./client-sales-4.types";
import { intList, parseOrderTypesParam, strList } from "./client-sales-4.helpers";

export function parseClientSales4Query(q: Record<string, string | undefined>): ClientSales4Filters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const cons =
    q.consignment === "yes" || q.consignment === "no" ? (q.consignment as "yes" | "no") : "all";
  const onlyWith =
    q.only_with_value === "1" || q.only_with_value === "true" || q.only_with_value === "yes";
  const from = (q.from ?? "").trim();
  const to = (q.to ?? "").trim();
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  return {
    from: from || defaultFrom,
    to: to || defaultTo,
    statuses: strList(q.statuses),
    order_types: parseOrderTypesParam(q.order_types),
    agent_ids: intList(q.agent_ids),
    category_ids: intList(q.category_ids),
    client_categories: strList(q.client_categories),
    trade_direction_ids: intList(q.trade_direction_ids),
    brand_ids: intList(q.brand_ids),
    consignment: cons,
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    only_with_value: onlyWith,
    page,
    limit
  };
}
