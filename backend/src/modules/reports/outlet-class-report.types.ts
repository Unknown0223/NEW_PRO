/** SalesDoc `/report/client/classification` — Классификация торговых точек (flat). */

export type OutletClassGroupBy = "client" | "class";

export type OutletClassBand = { name: string; min_sum: number };

export type OutletClassReportFilters = {
  from: string;
  to: string;
  group_by: OutletClassGroupBy;
  bands: OutletClassBand[];
  statuses: string[];
  agent_ids: number[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  search?: string;
  page: number;
  limit: number;
};

export type OutletClassReportRow = {
  row_number: number;
  class_name: string;
  client_id: number | null;
  client_name: string;
  agent_name: string;
  client_category: string;
  order_count: number;
  product_count: number;
  sales_sum: string;
  avg_check: string;
};

export type OutletClassReportTotals = {
  client_count: number;
  order_count: number;
  sales_sum: string;
};
