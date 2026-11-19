/** SalesDoc `/report/reportVisit` — По дневному посещению (flat day×agent). */

export type DailyVisitsVisitKind = "planned" | "unplanned";

export type DailyVisitsReportFilters = {
  year: number;
  month: number;
  from: string;
  to: string;
  agent_ids: number[];
  visit_kinds: DailyVisitsVisitKind[];
  search?: string;
  page: number;
  limit: number;
};

export type DailyVisitsReportRow = {
  row_number: number;
  work_date: string;
  agent_id: number;
  agent_name: string;
  visited: number;
  planned: number;
  not_visited: number;
  orders_count: number;
  photo_reports: number;
  refusals: number;
  visit_pct: number;
};

export type DailyVisitsReportTotals = {
  visited: number;
  planned: number;
  not_visited: number;
  orders_count: number;
  photo_reports: number;
  refusals: number;
};
