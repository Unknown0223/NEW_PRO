export type ProductSalesDateType = "order_date" | "shipped_date" | "delivered_date";

export type ProductSalesReportFilters = {
  date_type: ProductSalesDateType;
  from: string;
  to: string;
  statuses?: string[];
  order_types?: string[];
  category_ids?: number[];
  product_ids?: number[];
  product_group_ids?: number[];
  segment_ids?: number[];
  brand_ids?: number[];
  price_types?: string[];
  supervisor_ids?: number[];
  agent_ids?: number[];
  trade_direction_ids?: number[];
  payment_methods?: string[];
  warehouse_id?: number;
  active_only: boolean;
  /** Zakazda kamida bitta tasdiqlangan to‘lov (payment) bo‘lsa */
  paid_orders_only: boolean;
  consignment: "all" | "yes" | "no";
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  search?: string;
  page: number;
  limit: number;
  sort_by: "name" | "total" | "qty";
};
