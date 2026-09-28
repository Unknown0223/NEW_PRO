export type SalesDashboardFilters = {
  date_type: "order_date" | "shipment_date";
  from: string;
  to: string;
  status: string[];
  category_ids: number[];
  manufacturer_ids: number[];
  supervisor_ids: number[];
  /** Access «Сотрудники» / filtr: faqat shu agentlar. */
  agent_ids: number[];
  group_ids: number[];
  brand_ids: number[];
  territory_ids: number[];
  /** Клиент: зона / область / город (как в финансовом дашборде). */
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  payment_types: string[];
  trade_directions: string[];
};

export type SalesDashboardSnapshot = {
  filters: SalesDashboardFilters;
  total_sales_summary: {
    total_sales_sum: string;
    orders_count: number;
  };
  payment_method_analytics: Array<{
    payment_type: string;
    sales_sum: string;
    share_pct: number;
  }>;
  product_category_analytics: Array<{
    category: string;
    sales_sum: string;
    share_pct: number;
  }>;
  product_group_analytics: Array<{
    product_group: string;
    sales_sum: string;
    share_pct: number;
  }>;
  price_type_analytics: Array<{ price_type: string; sales_sum: string; share_pct: number }>;
  debt_aging: {
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
  refusal_reason_analytics: Array<{
    reason: string;
    count: number;
    share_pct: number;
  }>;
  sales_dynamics: Array<{
    period: string;
    sales_sum: string;
    orders_count: number;
  }>;
  akb_okb_block: {
    akb: number;
    okb: number;
    coverage_pct: number;
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
