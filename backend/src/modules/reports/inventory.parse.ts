import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { InventoryClientActive, InventoryDateType, InventoryFilters } from "./inventory.types";

export function parseInventoryQuery(q: Record<string, string | undefined>): InventoryFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const dtRaw = (q.date_type ?? "").trim();
  const date_type: InventoryDateType =
    dtRaw === "shipped_date" || dtRaw === "order_date" ? dtRaw : "order_date";
  const caRaw = (q.client_active ?? "").trim();
  const client_active: InventoryClientActive =
    caRaw === "active" || caRaw === "inactive" ? caRaw : "all";
  return {
    date_type,
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    inventory_types: strList(q.inventory_types),
    agent_ids: intList(q.agent_ids),
    supervisor_ids: intList(q.supervisor_ids),
    category_ids: intList(q.category_ids),
    statuses: strList(q.statuses),
    payment_methods: strList(q.payment_methods),
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    client_active,
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
