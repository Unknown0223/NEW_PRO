import { api } from "@/lib/api";

export type DailyKpiCell = {
  day_plan: number;
  sales: number;
  returns: number;
  fact: number;
  execution_pct: number | null;
};

export type DailyKpiDayMatrix = {
  day: string;
  period: { month: string; year: number; month_num: number; today: string };
  trade_directions: Array<{ id: number; name: string; code: string | null }>;
  direction_id: number | null;
  kpi_groups: Array<{ kpi_group_id: number; name: string; code: string | null }>;
  agents: Array<{
    agent_id: number;
    name: string;
    code: string | null;
    branch: string | null;
    cells: Record<string, DailyKpiCell>;
  }>;
  totals: {
    agents: number;
    day_plan_sum: number;
    sales_sum: number;
    returns_sum: number;
    fact_sum: number;
    execution_pct: number | null;
  };
  links: {
    setup: string;
    workdays: string;
    kpi_groups: string;
    sales_monitoring: string;
  };
};

export type DailyKpiAgentSummary = {
  agent_id: number;
  name: string;
  code: string | null;
  trade_direction_id: number | null;
  trade_direction_name: string | null;
  month_plan_sum: number;
  month_fact_sum: number;
  month_execution_pct: number | null;
  today_plan_sum: number;
  today_fact_sum: number;
  today_execution_pct: number | null;
  today_remaining_sum: number;
  working_days_total: number;
  remaining_working_days: number;
  carry_forward_sum: number;
  surplus_sum: number;
  status: string;
  has_plans: boolean;
};

export type DailyKpiOverview = {
  period: {
    month: string;
    year: number;
    month_num: number;
    today: string;
    days_in_month: number;
  };
  trade_directions: Array<{ id: number; name: string; code: string | null }>;
  totals: {
    agents: number;
    agents_with_plans: number;
    month_plan_sum: number;
    month_fact_sum: number;
    month_execution_pct: number | null;
    today_plan_sum: number;
    today_fact_sum: number;
    today_execution_pct: number | null;
    done: number;
    warn: number;
    pending: number;
    over: number;
  };
  agents: DailyKpiAgentSummary[];
  links: {
    setup: string;
    workdays: string;
    kpi_groups: string;
    sales_monitoring: string;
  };
};

export const dailyKpiDayKeys = {
  matrix: (tenantSlug: string | null, day: string, directionId: number | null) =>
    ["plans", "daily-kpi-day", tenantSlug, day, directionId] as const,
  overview: (
    tenantSlug: string | null,
    month: number,
    year: number,
    directionId: number | null
  ) => ["plans", "daily-kpi-overview", tenantSlug, month, year, directionId] as const
};

export async function fetchDailyKpiDayMatrix(
  tenantSlug: string,
  opts: { day: string; directionId?: number | null }
): Promise<DailyKpiDayMatrix> {
  const qs = new URLSearchParams({ day: opts.day });
  if (opts.directionId != null) qs.set("direction_id", String(opts.directionId));
  const res = await api.get<{ data: DailyKpiDayMatrix }>(
    `/api/${tenantSlug}/plans/daily-kpi?${qs.toString()}`
  );
  return res.data.data;
}

export async function fetchDailyKpiOverview(
  tenantSlug: string,
  opts: { month: number; year: number; directionId?: number | null }
): Promise<DailyKpiOverview> {
  const qs = new URLSearchParams({
    month: String(opts.month),
    year: String(opts.year)
  });
  if (opts.directionId != null) qs.set("direction_id", String(opts.directionId));
  const res = await api.get<{ data: DailyKpiOverview }>(
    `/api/${tenantSlug}/plans/daily-kpi?${qs.toString()}`
  );
  return res.data.data;
}
