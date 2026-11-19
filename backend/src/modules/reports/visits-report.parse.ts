import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { VisitsReportFilters, VisitsReportVisitKind } from "./visits-report.types";

const VISIT_KINDS = new Set<VisitsReportVisitKind>(["planned", "unplanned"]);

export function parseVisitsReportQuery(q: Record<string, string | undefined>): VisitsReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const visit_kinds = strList(q.visit_kinds).filter((v): v is VisitsReportVisitKind =>
    VISIT_KINDS.has(v as VisitsReportVisitKind)
  );
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    agent_ids: intList(q.agent_ids),
    supervisor_ids: intList(q.supervisor_ids),
    statuses: strList(q.statuses),
    visit_kinds,
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
