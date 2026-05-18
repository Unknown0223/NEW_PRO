import type { Visits2Filters } from "./visits-2.types";
import { intList, intListUnique, strList } from "./visits-2.helpers";

export function parseVisits2Query(q: Record<string, string | undefined>): Visits2Filters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = (q.from ?? "").trim() || defaultFrom;
  const to = (q.to ?? "").trim() || defaultTo;
  const sortByRaw = (q.sort_by ?? "client_name").trim();
  const sort_by: Visits2Filters["sort_by"] =
    sortByRaw === "client_id" ||
    sortByRaw === "last_visit" ||
    sortByRaw === "agent_name" ||
    sortByRaw === "territory"
      ? sortByRaw
      : "client_name";
  const sort_dir = q.sort_dir === "desc" ? "desc" : "asc";
  return {
    from,
    to,
    agent_ids: intList(q.agent_ids),
    client_categories: strList(q.client_categories),
    weekdays: intListUnique(q.weekdays),
    product_category_refs: strList(q.product_category_refs),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit,
    sort_by,
    sort_dir
  };
}

