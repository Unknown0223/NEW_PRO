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
  /** SalesDoc «Идентификация клиента» — inn yoki id. */
  client_code: string;
  client_id: number | null;
  client_name: string;
  agent_name: string;
  client_category: string;
  /** zone, region, city */
  territory: string;
  client_count: number;
  order_count: number;
  product_count: number;
  sales_sum: string;
  avg_check: string;
  /** Kategoriya nomi → foiz (0–100, string). */
  category_shares: Record<string, string>;
};

export type OutletClassReportTotals = {
  client_count: number;
  order_count: number;
  sales_sum: string;
};

export type OutletClassReportResult = {
  period_from: string;
  period_to: string;
  group_by: OutletClassGroupBy;
  bands: OutletClassBand[];
  page: number;
  limit: number;
  total: number;
  totals: OutletClassReportTotals;
  /** Dinamik «Доля категорий» ustunlari (nom tartibida). */
  category_columns: string[];
  rows: OutletClassReportRow[];
};
