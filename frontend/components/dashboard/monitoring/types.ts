export type MonitoringDraft = {
  month: number;
  year: number;
  branch_codes: string[];
  /** Tanlangan tugunlar `territory_nodes` daraxtidan (UUID). */
  territory_tree_node_ids: string[];
  territory_ids: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  agent_ids: string[];
  supervisor_ids: string[];
  payment_methods: string[];
  order_statuses: string[];
  category_ids: string[];
};

export type MonitoringSnapshot = {
  plan_fact: {
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_note: string;
  };
  summary?: {
    orders_count: number;
    delivered_orders_count: number;
    order_success_pct: number | null;
    aov: string;
    active_territory_keys: number;
    growth_vs_prev_month_sales_pct: number | null;
    growth_vs_prev_year_sales_pct: number | null;
    forecast_month_end_sales: string | null;
    return_loss_sum: string;
  };
  period: { from: string; to: string };
  akb_okb: { akb: number; okb: number; coverage_pct: number };
  category_sales: Array<{
    category: string;
    sales_sum: string;
    share_pct: number;
    orders_count?: number;
    line_qty?: string;
  }>;
  product_group_sales?: Array<{ product_group: string; sales_sum: string; share_pct: number }>;
  branch_performance: Array<{
    branch: string;
    akb: number;
    okb?: number;
    coverage_pct?: number;
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    rank?: number;
  }>;
  supervisor_performance: Array<{
    supervisor_id: number | null;
    supervisor_name: string;
    akb: number;
    orders_count?: number;
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_fact_gap?: string;
    rank?: number;
  }>;
  trade_directions: Array<{ direction: string; sales_sum: string; share_pct: number }>;
  daily_sales: Array<{ day: string; sales_sum: string; orders_count: number }>;
  sales_channels: Array<{
    channel: string;
    sales_sum: string;
    share_pct: number;
    orders_count?: number;
    active_clients?: number;
    avg_check?: string;
  }>;
  portfolio_akb: { akb: number; okb: number; coverage_pct: number };
  sku_matrix: Array<{
    sku: string;
    name: string;
    total_sum: string;
    total_qty?: string;
    sum_new: string;
    sum_confirmed: string;
    sum_shipped: string;
    sum_delivered: string;
    sum_cancelled: string;
    sum_returned: string;
    return_pct?: number | null;
    cancel_pct?: number | null;
  }>;
  client_daily_sales: Array<{ client_id: number; client_name: string; day: string; sales_sum: string }>;
  year_comparison?: {
    current: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    previous: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    growth_pct: { akb: number | null; orders_count: number | null; sales_sum: number | null };
  };
  meta?: { branch_options: string[]; payment_method_options?: string[] };
};

export type PerformanceTab = "branches" | "supervisors" | "directions";
