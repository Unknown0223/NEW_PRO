export type ExcelExportDateType = "order_date" | "shipped_date" | "delivered_date";

export type ExcelExportFilters = {
  date_type: ExcelExportDateType;
  from: string;
  to: string;
  agent_ids?: number[];
  expeditor_ids?: number[];
  category_ids?: number[];
  product_ids?: number[];
  client_categories?: string[];
  statuses?: string[];
  warehouse_ids?: number[];
  price_types?: string[];
  payment_methods?: string[];
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  search?: string;
  page: number;
  limit: number;
};

/** SalesDoc Version1 status cards. */
export type ExcelExportStatusBucket =
  | "all"
  | "new"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";

export type ExcelExportStatusSummary = {
  id: ExcelExportStatusBucket;
  label: string;
  /** Statuses applied when card is selected (`all` → clear filter). */
  statuses: string[];
  amount: string;
  qty: string;
  volume: string;
  akb: number;
};

export type ExcelExportRow = {
  row_number: number;
  order_id: number;
  order_number: string;
  shipped_at: string | null;
  client_id: number;
  client_name: string;
  client_code: string;
  product_id: number;
  product_name: string;
  product_sku: string;
  qty: string;
  status: string;
  status_label: string;
  agent_name: string;
  agent_code: string;
  expeditor_name: string;
  expeditor_code: string;
  client_category: string;
  territory: string;
  price_type: string;
  payment_method: string;
  product_category: string;
  unit: string;
  price: string;
  amount: string;
  discount: string;
  order_date: string;
  delivered_at: string | null;
};
