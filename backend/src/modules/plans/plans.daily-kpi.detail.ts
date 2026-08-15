import { prisma } from "../../config/database";
import { getMobileAgentKpi } from "../mobile/mobile-agent-kpi.service";
import type { KpiDailyRoutePlan } from "../mobile/mobile-agent-kpi-daily-route";
import type { DailyKpiDetailQuery } from "./plans.daily-kpi.schema";
import { sectionLinks, statusFromDay } from "./plans.daily-kpi.helpers";
import type { DailyKpiAgentSummary, DailyKpiOverviewResult } from "./plans.daily-kpi.service";

export type DailyKpiDetailResult = {
  overview: DailyKpiAgentSummary;
  daily_route: KpiDailyRoutePlan;
  kpi_groups: Awaited<ReturnType<typeof getMobileAgentKpi>>["kpi_groups"];
  month: Awaited<ReturnType<typeof getMobileAgentKpi>>["month"];
  today: Awaited<ReturnType<typeof getMobileAgentKpi>>["today"];
  notes: Awaited<ReturnType<typeof getMobileAgentKpi>>["notes"];
  links: DailyKpiOverviewResult["links"];
};

export async function getDailyKpiAgentDetail(
  tenantId: number,
  agentId: number,
  query: DailyKpiDetailQuery
): Promise<DailyKpiDetailResult> {
  const user = await prisma.user.findFirst({
    where: { id: agentId, tenant_id: tenantId, role: "agent" },
    select: { id: true, name: true, code: true, trade_direction_id: true }
  });
  if (!user) throw new Error("NOT_FOUND");

  const monthKey = `${query.year}-${String(query.month).padStart(2, "0")}`;
  const kpi = await getMobileAgentKpi(tenantId, agentId, monthKey);
  const route = kpi.daily_route;
  const todayFact = kpi.today.sales_sum;
  const isWorkingToday = route.days.some((d) => d.date === kpi.period.today && d.is_working_day);

  const overview: DailyKpiAgentSummary = {
    agent_id: user.id,
    name: user.name,
    code: user.code,
    trade_direction_id: user.trade_direction_id,
    trade_direction_name: null,
    month_plan_sum: kpi.month.plan_sum,
    month_fact_sum: kpi.month.fact_sum,
    month_execution_pct: kpi.month.execution_pct,
    today_plan_sum: kpi.today.plan_day_sum,
    today_fact_sum: todayFact,
    today_execution_pct: kpi.today.execution_pct,
    today_remaining_sum: kpi.today.remaining_sum,
    working_days_total: route.working_days_total,
    remaining_working_days: route.remaining_working_days,
    carry_forward_sum: route.carry_forward_sum,
    surplus_sum: route.surplus_sum,
    status: statusFromDay({
      hasPlans: kpi.month.has_plans,
      todayPlan: kpi.today.plan_day_sum,
      todayFact,
      isWorkingToday
    }),
    has_plans: kpi.month.has_plans
  };

  return {
    overview,
    daily_route: route,
    kpi_groups: kpi.kpi_groups,
    month: kpi.month,
    today: kpi.today,
    notes: kpi.notes,
    links: sectionLinks(query.month, query.year, user.trade_direction_id)
  };
}
