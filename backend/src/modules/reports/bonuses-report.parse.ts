import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { BonusesDateType, BonusesGroupBy, BonusesReportFilters } from "./bonuses-report.types";

const DATE_TYPES = new Set<BonusesDateType>(["created_at", "shipped_date"]);
const GROUP_BY = new Set<BonusesGroupBy>(["product", "agent", "client", "category"]);

export function parseBonusesReportQuery(q: Record<string, string | undefined>): BonusesReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const dateRaw = (q.date_type ?? "").trim() as BonusesDateType;
  const groupRaw = (q.group_by ?? "").trim() as BonusesGroupBy;
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    date_type: DATE_TYPES.has(dateRaw) ? dateRaw : "created_at",
    group_by: GROUP_BY.has(groupRaw) ? groupRaw : "product",
    statuses: strList(q.statuses),
    agent_ids: intList(q.agent_ids),
    category_ids: intList(q.category_ids),
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
