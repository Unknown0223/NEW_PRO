/** SalesDoc `/report/planExpeditor` — Визиты экспедиторов (flat). */

export type ExpeditorVisitsReportFilters = {
  from: string;
  to: string;
  expeditor_ids: number[];
  search?: string;
  page: number;
  limit: number;
};

export type ExpeditorVisitsReportRow = {
  row_number: number;
  expeditor_id: number;
  expeditor_name: string;
  planned: number;
  visited: number;
  no_visited: number;
  order_count: number;
  defect_count: number;
  payment_sum: string;
};

export type ExpeditorVisitsReportTotals = {
  planned: number;
  visited: number;
  no_visited: number;
  order_count: number;
  defect_count: number;
  payment_sum: string;
};
