import { monthToDateYmd } from "../../lib/month-to-date";
import { intList } from "./expeditor-returns.helpers";
import type { ExpeditorVisitsReportFilters } from "./expeditor-visits-report.types";

export function parseExpeditorVisitsReportQuery(
  q: Record<string, string | undefined>
): ExpeditorVisitsReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    expeditor_ids: intList(q.expeditor_ids),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
