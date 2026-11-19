/** SalesDoc `/report/agent/visit` — По визитам (flat agent KPI). */

export type VisitsReportVisitKind = "planned" | "unplanned";

export type VisitsReportFilters = {
  from: string;
  to: string;
  agent_ids: number[];
  supervisor_ids: number[];
  statuses: string[];
  visit_kinds: VisitsReportVisitKind[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  search?: string;
  page: number;
  limit: number;
};

export type VisitsReportRow = {
  row_number: number;
  agent_id: number;
  agent_name: string;
  okb: number;
  akb: number;
  orders_count: number;
  sales_sum: string;
  refusals: number;
  photo_reports: number;
  visited: number;
  not_visited: number;
  planned: number;
  visit_pct: number;
};

export type VisitsReportTotals = {
  okb: number;
  akb: number;
  orders_count: number;
  sales_sum: string;
  refusals: number;
  photo_reports: number;
  visited: number;
  not_visited: number;
  planned: number;
};
