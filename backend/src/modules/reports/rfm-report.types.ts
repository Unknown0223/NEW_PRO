/** SalesDoc `/report/rfm` — RFM по клиентам (flat). */

export type RfmReportFilters = {
  from: string;
  to: string;
  agent_ids: number[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  search?: string;
  page: number;
  limit: number;
};

export type RfmReportRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  agent_name: string;
  client_category: string;
  last_order_at: string;
  last_order_days: number;
  order_count: number;
  sales_sum: string;
  avg_check: string;
  r_score: number;
  f_score: number;
  m_score: number;
  rfm_label: string;
};

export type RfmReportTotals = {
  client_count: number;
  order_count: number;
  sales_sum: string;
};