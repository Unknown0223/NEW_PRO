/** SALEC «Доли по экспедиторам» — flat ulush hisobot. */

export type ExpeditorShareReportFilters = {
  from: string;
  to: string;
  expeditor_ids: number[];
  search?: string;
  page: number;
  limit: number;
};

export type ExpeditorShareReportRow = {
  row_number: number;
  expeditor_id: number;
  expeditor_name: string;
  order_count: number;
  sales_sum: string;
  share_pct: string;
  client_count: number;
  payment_sum: string;
};

export type ExpeditorShareReportTotals = {
  order_count: number;
  sales_sum: string;
  client_count: number;
  payment_sum: string;
};