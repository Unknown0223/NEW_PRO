import { intList, strList } from "./expeditor-returns.helpers";
import type { DailyVisitsReportFilters, DailyVisitsVisitKind } from "./daily-visits-report.types";

const VISIT_KINDS = new Set<DailyVisitsVisitKind>(["planned", "unplanned"]);

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDailyVisitsReportQuery(q: Record<string, string | undefined>): DailyVisitsReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const now = new Date();
  let year = Number.parseInt(q.year ?? "", 10);
  let month = Number.parseInt(q.month ?? "", 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) year = now.getUTCFullYear();
  if (!Number.isFinite(month) || month < 1) month = now.getUTCMonth() + 1;
  if (month > 12) month = 12;
  const last = daysInMonth(year, month);
  const visit_kinds = strList(q.visit_kinds).filter((v): v is DailyVisitsVisitKind =>
    VISIT_KINDS.has(v as DailyVisitsVisitKind)
  );
  return {
    year,
    month,
    from: ymd(year, month, 1),
    to: ymd(year, month, last),
    agent_ids: intList(q.agent_ids),
    visit_kinds,
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
