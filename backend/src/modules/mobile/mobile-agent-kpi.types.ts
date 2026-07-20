export type MobileAgentKpiMetricBlock = {
  cost: number;
  count: number;
  volume: number;
  acb: number;
  order_count: number;
};

export type MobileAgentKpiGroupRow = {
  kpi_group_id: number;
  name: string;
  code: string | null;
  /** Settings «Группа KPI» → Активный; inactive guruhlar API dan chiqarilmaydi. */
  is_active: boolean;
  plan_status: string;
  product_count: number;
  plan: MobileAgentKpiMetricBlock;
  fact: MobileAgentKpiMetricBlock;
  primary_metric: keyof MobileAgentKpiMetricBlock;
  execution_pct: number | null;
  remaining_primary: number | null;
  /** Bugungi kunlik ulush (qoldiq / qolgan ish kunlari). */
  today_plan_primary: number;
  /** Bugungi fakt (shu guruh). */
  today_fact_primary: number;
  today_execution_pct: number | null;
  today_remaining_primary: number;
  /** Teng ulush (faqat UI); webda weight maydoni yo‘q. */
  weight_pct: number | null;
  score: number | null;
  hint: string | null;
};

export type MobileAgentKpiResult = {
  period: {
    month: string;
    today: string;
    year: number;
    month_num: number;
    days_in_month: number;
    day_of_month: number;
  };
  agent: { id: number; name: string; code: string | null };
  today: {
    sales_sum: number;
    /** Dinamik kunlik reja (oylik qoldiq / qolgan ish kunlari). */
    plan_day_sum: number;
    /** Oddiy ulush: oy / ish kunlari soni. */
    base_plan_day_sum: number;
    execution_pct: number | null;
    remaining_sum: number;
    visits: number;
    orders_count: number;
    volume_qty: number;
    sku_focus: { fact: number; plan: number; label: string | null } | null;
    vs_yesterday_pct: number | null;
  };
  month: {
    plan_sum: number;
    fact_sum: number;
    execution_pct: number | null;
    remaining_sum: number;
    forecast_pct: number | null;
    has_plans: boolean;
  };
  /** Ish kunlari bo‘yicha kunlik plan / fakt (carry-forward). */
  daily_route: {
    working_days_total: number;
    remaining_working_days: number;
    past_working_days: number;
    base_day_plan: number;
    today_plan_sum: number;
    fact_before_today: number;
    month_remaining_before_today: number;
    carry_forward_sum: number;
    surplus_sum: number;
    vs_yesterday_pct: number | null;
    days: Array<{
      date: string;
      is_working_day: boolean;
      is_today: boolean;
      is_future: boolean;
      plan_sum: number;
      fact_sum: number;
      execution_pct: number | null;
      remaining_sum: number;
      over_sum: number;
      carry_in: number;
      status: "done" | "over" | "warn" | "pending" | "off";
    }>;
  };
  kpi_groups: MobileAgentKpiGroupRow[];
  week: Array<{ date: string; weekday: number; sales_sum: number; execution_pct: number | null; plan_sum?: number }>;
  timesheet: {
    coefficient: number | null;
    active_days: number;
    excused_days: number;
    inactive_days: number;
    off_days: number;
    worked_days: number;
    sales_total: number;
    visits_total: number;
  };
  /** kpi_results jadvalidan (agar hisoblangan bo‘lsa). */
  stored_results: Array<{
    metric: string;
    value: number;
    target: number | null;
    score: number | null;
    kpi_group_id: number | null;
    comment: string | null;
  }>;
  notes: {
    plan_source: string;
    bonus_available: boolean;
  };
};
