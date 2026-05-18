import type { ClientSales2Filters, ConsignmentMode } from "./client-sales-2.types";
import { intList, numOr, strList } from "./client-sales-2.helpers";

export function parseClientSales2Query(q: Record<string, string | undefined>): ClientSales2Filters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const activity = q.client_activity === "active" || q.client_activity === "inactive" ? q.client_activity : "all";
  const consignmentMode: ConsignmentMode =
    q.consignment_mode === "regular" || q.consignment_mode === "consignment" ? q.consignment_mode : "all";
  const dayVisitIso = intList(q.day_visit_iso).filter((x) => x >= 1 && x <= 7);
  return {
    date_type:
      q.date_type === "shipped_date" || q.date_type === "delivered_date" || q.date_type === "created_date"
        ? q.date_type
        : "order_date",
    from: q.from,
    to: q.to,
    statuses: strList(q.statuses),
    status: q.status?.trim() || undefined,
    category_ids: intList(q.category_ids),
    product_ids: intList(q.product_ids),
    product_group_ids: intList(q.product_group_ids),
    segment_ids: intList(q.segment_ids),
    day_visit_iso: dayVisitIso,
    agent_ids: intList(q.agent_ids),
    agent_id: q.agent_id ? Number.parseInt(q.agent_id, 10) : undefined,
    price_types: strList(q.price_types),
    price_type: q.price_type?.trim() || undefined,
    order_types: strList(q.order_types),
    order_type: q.order_type?.trim() || undefined,
    consignment_mode: consignmentMode,
    client_categories: strList(q.client_categories),
    client_category: q.client_category?.trim() || undefined,
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    territory_1: q.territory_1?.trim() || undefined,
    territory_2: q.territory_2?.trim() || undefined,
    territory_3: q.territory_3?.trim() || undefined,
    client_activity: activity,
    sum_from: numOr(q.sum_from),
    sum_to: numOr(q.sum_to),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}

