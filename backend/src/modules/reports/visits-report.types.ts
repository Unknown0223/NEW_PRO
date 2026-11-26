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

/** SalesDoc ajaxPlannedNewVisits `type` (empty → okb). */
export type VisitsDetailType =
  | "okb"
  | "only_order"
  | "rejected"
  | "only_photo"
  | "not_visited"
  | "visited";

export type VisitsDetailFilters = VisitsReportFilters & {
  agent_id: number;
  type: VisitsDetailType;
};

export type VisitsDetailRow = {
  client_id: number;
  client_name: string;
  visited_at: string | null;
  order_sum: string;
  refusal_label: string;
  photo_count: number;
  inventory_label: string;
  last_purchase_sum: string;
  last_purchase_at: string | null;
};
