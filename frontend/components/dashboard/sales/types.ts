export type SalesDateType = "order_date" | "shipment_date" | "delivery_date";

export type SalesFilterDraft = {
  date_type: SalesDateType;
  from: string;
  to: string;
  status: string[];
  category_ids: string[];
  manufacturer_ids: string[];
  supervisor_ids: string[];
  group_ids: string[];
  brand_ids: string[];
  trade_directions: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  payment_types: string[];
};

export type { QuickRangeKey } from "@/components/dashboard/shared/quick-range";

export type SalesDashboardSnapshot = {
  total_sales_summary: {
    total_sales_sum: string;
    orders_count: number;
  };
  payment_method_analytics: Array<{ payment_type: string; sales_sum: string; share_pct: number }>;
  product_category_analytics: Array<{ category: string; sales_sum: string; share_pct: number }>;
  product_group_analytics: Array<{ product_group: string; sales_sum: string; share_pct: number }>;
  price_type_analytics?: Array<{ price_type: string; sales_sum: string; share_pct: number }>;
  debt_aging?: {
    total_debt: string;
    debtors_count: number;
    buckets: Array<{
      key: "d0_7" | "d8_14" | "d15_21" | "d22_30" | "d30_plus";
      sum: string;
      share_pct: number;
    }>;
  };
  category_performance_table: Array<{
    category: string;
    sales_sum: string;
    sold_qty: string;
    volume: string;
    bonus_qty: string;
    akb: number;
    share_pct: number;
  }>;
  orders_refusals: {
    accepted: number;
    rejected: number;
    pending: number;
    total: number;
    conversion_pct: number;
  };
  refusal_reason_analytics: Array<{ reason: string; count: number; share_pct: number }>;
  sales_dynamics: Array<{ period: string; sales_sum: string; orders_count: number; returns_sum?: string }>;
  akb_okb_block: { akb: number; okb: number; coverage_pct: number };
  risk_zone?: {
    okb: number;
    with_order: number;
    with_refusal: number;
    visited_only: number;
    not_visited: number;
    orders_count: number;
    refusals_count: number;
    daily?: Array<{ date: string; orders: number; refusals: number; not_visited: number }>;
  };
  territory_analytics: Array<{
    territory: string;
    sales_sum: string;
    akb: number;
    okb: number;
    coverage_pct: number;
  }>;
  agent_analytics: Array<{
    agent_id: number;
    agent_name: string;
    agent_code: string | null;
    sales_sum: string;
    akb: number;
    okb: number;
    coverage_pct: number;
  }>;
};

export type SalesSummaryPayload = Pick<
  SalesDashboardSnapshot,
  | "total_sales_summary"
  | "payment_method_analytics"
  | "price_type_analytics"
  | "debt_aging"
  | "akb_okb_block"
  | "risk_zone"
  | "orders_refusals"
>;

export type SalesAnalyticsPayload = Pick<
  SalesDashboardSnapshot,
  | "product_category_analytics"
  | "product_group_analytics"
  | "category_performance_table"
  | "sales_dynamics"
  | "refusal_reason_analytics"
>;

export type SalesBreakdownPayload = Pick<SalesDashboardSnapshot, "territory_analytics" | "agent_analytics"> & {
  agent_total: number;
};
