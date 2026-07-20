import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getWorkdaysState } from "../tabel/workdays.service";
import {
  buildKpiDailyRoutePlan,
  listAgentWorkingDaysInMonth
} from "../mobile/mobile-agent-kpi-daily-route";
import {
  workRegionDayRange,
  workRegionTodayKey
} from "../mobile/mobile-agent-sync.config.service";
import { executionPctFromPlanFact, WORKING_KPI_PLAN_STATUSES } from "./plans.monitoring-aggregates";
import type { DailyKpiOverviewQuery } from "./plans.daily-kpi.schema";
import {
  fallbackWorkdaysState,
  monthBounds,
  routeAsOfKey,
  sectionLinks,
  statusFromDay,
  type DailyKpiDayStatus
} from "./plans.daily-kpi.helpers";
import {
  buildDailyKpiUserWhere,
  parseDailyKpiAgentScope,
  resolveAgentIdsByClientTerritory,
  withEmptyBranchOption
} from "./plans.daily-kpi.scope";
import {
  buildDailyKpiGroupSummaries,
  type DailyKpiGroupSummary
} from "./plans.daily-kpi.groups";
import { loadActiveBranchNames } from "../tenant-settings/tenant-settings.refs";

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v instanceof Prisma.Decimal ? v.toString() : v);
}

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
  status: DailyKpiDayStatus;
  has_plans: boolean;
};

export type DailyKpiOverviewResult = {
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
  kpi_groups: DailyKpiGroupSummary[];
  links: {
    setup: string;
    workdays: string;
    kpi_groups: string;
    sales_monitoring: string;
  };
  filter_meta: {
    branch_options: string[];
  };
};

async function listTradeDirections(tenantId: number) {
  return prisma.tradeDirection.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true }
  });
}

function emptyOverview(
  monthKey: string,
  year: number,
  month: number,
  todayKey: string,
  daysInMonth: number
): DailyKpiOverviewResult {
  return {
    period: {
      month: monthKey,
      year,
      month_num: month,
      today: todayKey,
      days_in_month: daysInMonth
    },
    trade_directions: [],
    totals: {
      agents: 0,
      agents_with_plans: 0,
      month_plan_sum: 0,
      month_fact_sum: 0,
      month_execution_pct: null,
      today_plan_sum: 0,
      today_fact_sum: 0,
      today_execution_pct: null,
      done: 0,
      warn: 0,
      pending: 0,
      over: 0
    },
    agents: [],
    kpi_groups: [],
    links: sectionLinks(month, year, null),
    filter_meta: { branch_options: [] }
  };
}

/** Admin: ilovadagi kunlik KPI planlarining web ko‘rinishi. */
export async function getDailyKpiOverview(
  tenantId: number,
  query: DailyKpiOverviewQuery
): Promise<DailyKpiOverviewResult> {
  const { month, year } = query;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const todayKey = workRegionTodayKey();
  const { start: monthStart, end: monthEnd, daysInMonth } = monthBounds(year, month);
  const asOf = routeAsOfKey(monthKey, todayKey, daysInMonth);
  const { start: todayStart, end: todayEnd } =
    monthKey === todayKey.slice(0, 7)
      ? workRegionDayRange(todayKey)
      : workRegionDayRange(asOf);

  const directions = await listTradeDirections(tenantId);
  const directionId = query.direction_id ?? directions[0]?.id ?? null;
  const branchOptions = await loadActiveBranchNames(tenantId).catch(() => [] as string[]);
  if (directionId == null) {
    const empty = emptyOverview(monthKey, year, month, todayKey, daysInMonth);
    return { ...empty, filter_meta: { branch_options: branchOptions } };
  }

  const direction = directions.find((d) => d.id === directionId) ?? null;
  const scope = parseDailyKpiAgentScope(query);
  const territoryAgentIds = await resolveAgentIdsByClientTerritory(tenantId, scope);
  const userWhere = buildDailyKpiUserWhere(tenantId, scope, query.search, territoryAgentIds);

  const targetRows = await prisma.salesKpiPlanTarget.findMany({
    where: {
      tenant_id: tenantId,
      plan: {
        tenant_id: tenantId,
        month,
        year,
        trade_direction_id: directionId,
        status: { in: [...WORKING_KPI_PLAN_STATUSES] },
        kpi_group: { is_active: true }
      },
      user: userWhere
    },
    select: {
      user_id: true,
      cost: true,
      user: {
        select: {
          id: true,
          name: true,
          code: true,
          trade_direction_id: true
        }
      },
      plan: {
        select: {
          kpi_group_id: true,
          kpi_group: { select: { id: true, name: true, code: true } }
        }
      }
    }
  });

  const planByAgent = new Map<number, number>();
  const agentMeta = new Map<
    number,
    { id: number; name: string; code: string | null; trade_direction_id: number | null }
  >();
  for (const t of targetRows) {
    planByAgent.set(t.user_id, (planByAgent.get(t.user_id) ?? 0) + num(t.cost));
    if (!agentMeta.has(t.user_id)) {
      agentMeta.set(t.user_id, {
        id: t.user.id,
        name: t.user.name,
        code: t.user.code,
        trade_direction_id: t.user.trade_direction_id
      });
    }
  }

  // Prefixed so empty-branch agents from setup («Без филиала») appear in filter.
  const hasEmptyBranchAgent = await prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      OR: [{ branch: null }, { branch: "" }]
    },
    select: { id: true }
  });
  const branchOptionsWithEmpty = withEmptyBranchOption(branchOptions, Boolean(hasEmptyBranchAgent));

  const agentIds = [...agentMeta.keys()];
  const monthFactByAgent = new Map<number, number>();
  const todayFactByAgent = new Map<number, number>();
  const salesByAgentDate = new Map<number, Map<string, number>>();

  if (agentIds.length > 0) {
    const [monthFacts, todayFacts, dailySales] = await Promise.all([
      prisma.$queryRaw<Array<{ agent_id: number; sales: Prisma.Decimal }>>`
        SELECT o.agent_id, COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND o.order_type = 'order'
          AND o.created_at >= ${monthStart}
          AND o.created_at < ${monthEnd}
        GROUP BY o.agent_id
      `,
      prisma.$queryRaw<Array<{ agent_id: number; sales: Prisma.Decimal }>>`
        SELECT o.agent_id, COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND o.order_type = 'order'
          AND o.created_at >= ${todayStart}
          AND o.created_at <= ${todayEnd}
        GROUP BY o.agent_id
      `,
      prisma.$queryRaw<Array<{ agent_id: number; day: Date; sales: Prisma.Decimal }>>`
        SELECT o.agent_id,
               (timezone('Asia/Tashkent', o.created_at))::date AS day,
               COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND o.order_type = 'order'
          AND o.created_at >= ${monthStart}
          AND o.created_at < ${monthEnd}
        GROUP BY o.agent_id, 2
      `
    ]);

    for (const r of monthFacts) monthFactByAgent.set(r.agent_id, num(r.sales));
    for (const r of todayFacts) todayFactByAgent.set(r.agent_id, num(r.sales));
    for (const r of dailySales) {
      const key =
        r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
      let map = salesByAgentDate.get(r.agent_id);
      if (!map) {
        map = new Map();
        salesByAgentDate.set(r.agent_id, map);
      }
      map.set(key, num(r.sales));
    }
  }

  let workdaysState;
  try {
    workdaysState = await getWorkdaysState(tenantId);
  } catch {
    workdaysState = fallbackWorkdaysState();
  }

  const agents: DailyKpiAgentSummary[] = [];
  for (const agentId of agentIds) {
    const meta = agentMeta.get(agentId)!;
    const monthPlan = planByAgent.get(agentId) ?? 0;
    const monthFact = monthFactByAgent.get(agentId) ?? 0;
    const todayFact = todayFactByAgent.get(agentId) ?? 0;
    const workingDays = listAgentWorkingDaysInMonth(workdaysState, year, month, agentId);

    const route = buildKpiDailyRoutePlan({
      monthPlan,
      year,
      monthNum: month,
      todayKey: asOf,
      salesByDate: salesByAgentDate.get(agentId) ?? new Map(),
      workingDays
    });

    const isWorkingToday = workingDays.includes(asOf);
    agents.push({
      agent_id: agentId,
      name: meta.name,
      code: meta.code,
      trade_direction_id: meta.trade_direction_id,
      trade_direction_name: direction?.name ?? null,
      month_plan_sum: monthPlan,
      month_fact_sum: monthFact,
      month_execution_pct: executionPctFromPlanFact(monthPlan, monthFact),
      today_plan_sum: route.today_plan_sum,
      today_fact_sum: todayFact,
      today_execution_pct: executionPctFromPlanFact(route.today_plan_sum, todayFact),
      today_remaining_sum: Math.max(0, route.today_plan_sum - todayFact),
      working_days_total: route.working_days_total,
      remaining_working_days: route.remaining_working_days,
      carry_forward_sum: route.carry_forward_sum,
      surplus_sum: route.surplus_sum,
      status: statusFromDay({
        hasPlans: monthPlan > 0,
        todayPlan: route.today_plan_sum,
        todayFact,
        isWorkingToday
      }),
      has_plans: monthPlan > 0
    });
  }

  agents.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const monthPlanSum = agents.reduce((s, a) => s + a.month_plan_sum, 0);
  const monthFactSum = agents.reduce((s, a) => s + a.month_fact_sum, 0);
  const todayPlanSum = agents.reduce((s, a) => s + a.today_plan_sum, 0);
  const todayFactSum = agents.reduce((s, a) => s + a.today_fact_sum, 0);

  const kpi_groups = await buildDailyKpiGroupSummaries({
    tenantId,
    targetRows,
    agentIds,
    agents,
    monthStart,
    monthEnd,
    todayStart,
    todayEnd,
    monthFactSum,
    todayFactSum
  });

  return {
    period: {
      month: monthKey,
      year,
      month_num: month,
      today: todayKey,
      days_in_month: daysInMonth
    },
    trade_directions: directions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null })),
    totals: {
      agents: agents.length,
      agents_with_plans: agents.filter((a) => a.has_plans).length,
      month_plan_sum: monthPlanSum,
      month_fact_sum: monthFactSum,
      month_execution_pct: executionPctFromPlanFact(monthPlanSum, monthFactSum),
      today_plan_sum: todayPlanSum,
      today_fact_sum: todayFactSum,
      today_execution_pct: executionPctFromPlanFact(todayPlanSum, todayFactSum),
      done: agents.filter((a) => a.status === "done").length,
      warn: agents.filter((a) => a.status === "warn").length,
      pending: agents.filter((a) => a.status === "pending").length,
      over: agents.filter((a) => a.status === "over").length
    },
    agents,
    kpi_groups,
    links: sectionLinks(month, year, directionId),
    filter_meta: { branch_options: branchOptionsWithEmpty }
  };
}
