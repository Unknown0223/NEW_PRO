/** Filtrlarni URL query dan */
export type SalesMonitoringFilters = {
  month: number;
  year: number;
  /** `User.branch` qiymatlari (vergul bilan) */
  branch_codes: string[];
  territory_ids: number[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  agent_ids: number[];
  supervisor_ids: number[];
  /** `orders.payment_method_ref` */
  payment_method_refs: string[];
  /** Bo‘sh bo‘lsa — savdo uchun default: cancelled/returned chiqariladi */
  order_statuses: string[];
  category_ids: number[];
  /** SKU yoki nom bo‘yicha qidiruv (ILIKE) */
  sku_search?: string;
};

export type SalesMonitoringSnapshot = {
  filters: SalesMonitoringFilters;
  period: { from: string; to: string };
  plan_fact: {
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_note: string;
  };
  summary: {
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
  akb_okb: { akb: number; okb: number; coverage_pct: number };
  category_sales: Array<{
    category: string;
    sales_sum: string;
    share_pct: number;
    orders_count: number;
    line_qty: string;
  }>;
  /** Продажи по группе товаров (каталог); без группы — «Без группы» */
  product_group_sales: Array<{ product_group: string; sales_sum: string; share_pct: number }>;
  branch_performance: Array<{
    branch: string;
    akb: number;
    okb: number;
    coverage_pct: number;
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    rank: number;
  }>;
  supervisor_performance: Array<{
    supervisor_id: number | null;
    supervisor_name: string;
    akb: number;
    orders_count: number;
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_fact_gap: string;
    rank: number;
  }>;
  trade_directions: Array<{ direction: string; sales_sum: string; share_pct: number }>;
  daily_sales: Array<{ day: string; sales_sum: string; orders_count: number }>;
  sales_channels: Array<{
    channel: string;
    sales_sum: string;
    share_pct: number;
    orders_count: number;
    active_clients: number;
    avg_check: string;
  }>;
  portfolio_akb: { akb: number; okb: number; coverage_pct: number };
  sku_matrix: Array<{
    product_id: number;
    sku: string;
    name: string;
    total_sum: string;
    total_qty: string;
    sum_new: string;
    sum_confirmed: string;
    sum_shipped: string;
    sum_delivered: string;
    sum_cancelled: string;
    sum_returned: string;
    return_pct: number | null;
    cancel_pct: number | null;
  }>;
  client_daily_sales: Array<{ client_id: number; client_name: string; day: string; sales_sum: string }>;
  year_comparison: {
    current: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    previous: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    growth_pct: { akb: number | null; orders_count: number | null; sales_sum: number | null };
  };
  meta: { branch_options: string[]; payment_method_options: string[] };
};
