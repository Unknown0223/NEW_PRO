import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { executionPctFromPlanFact } from "./plans.monitoring-aggregates";
import { statusFromDay, type DailyKpiDayStatus } from "./plans.daily-kpi.helpers";

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v instanceof Prisma.Decimal ? v.toString() : v);
}

export type DailyKpiGroupSummary = {
  kpi_group_id: number;
  name: string;
  code: string | null;
  agent_count: number;
  month_plan_sum: number;
  month_fact_sum: number;
  month_execution_pct: number | null;
  today_plan_sum: number;
  today_fact_sum: number;
  today_execution_pct: number | null;
  remaining_sum: number;
  status: DailyKpiDayStatus;
};

type TargetRow = {
  user_id: number;
  cost: Prisma.Decimal | number;
  plan: {
    kpi_group_id: number;
    kpi_group: { id: number; name: string; code: string | null };
  };
};

/** KPI guruhlar bo‘yicha agregat (ko‘rinish: «KPI группы»). */
export async function buildDailyKpiGroupSummaries(opts: {
  tenantId: number;
  targetRows: TargetRow[];
  agentIds: number[];
  agents: Array<{ remaining_working_days: number }>;
  monthStart: Date;
  monthEnd: Date;
  todayStart: Date;
  todayEnd: Date;
  monthFactSum: number;
  todayFactSum: number;
}): Promise<DailyKpiGroupSummary[]> {
  const {
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
  } = opts;

  const groupPlan = new Map<
    number,
    { name: string; code: string | null; plan: number; agents: Set<number> }
  >();
  for (const t of targetRows) {
    const gid = t.plan.kpi_group_id;
    const g = t.plan.kpi_group;
    let row = groupPlan.get(gid);
    if (!row) {
      row = { name: g.name, code: g.code, plan: 0, agents: new Set() };
      groupPlan.set(gid, row);
    }
    row.plan += num(t.cost);
    row.agents.add(t.user_id);
  }

  const groupIds = [...groupPlan.keys()];
  const monthFactByGroup = new Map<number, number>();
  const todayFactByGroup = new Map<number, number>();
  if (groupIds.length > 0 && agentIds.length > 0) {
    const [monthGroupFacts, todayGroupFacts] = await Promise.all([
      prisma.$queryRaw<Array<{ kpi_group_id: number; sales: Prisma.Decimal }>>`
        SELECT kgp.kpi_group_id, COALESCE(SUM(oi.total), 0)::numeric(18,2) AS sales
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
        JOIN kpi_group_products kgp ON kgp.product_id = oi.product_id
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND o.order_type = 'order'
          AND o.created_at >= ${monthStart}
          AND o.created_at < ${monthEnd}
          AND kgp.kpi_group_id IN (${Prisma.join(groupIds)})
        GROUP BY kgp.kpi_group_id
      `,
      prisma.$queryRaw<Array<{ kpi_group_id: number; sales: Prisma.Decimal }>>`
        SELECT kgp.kpi_group_id, COALESCE(SUM(oi.total), 0)::numeric(18,2) AS sales
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
        JOIN kpi_group_products kgp ON kgp.product_id = oi.product_id
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND o.order_type = 'order'
          AND o.created_at >= ${todayStart}
          AND o.created_at <= ${todayEnd}
          AND kgp.kpi_group_id IN (${Prisma.join(groupIds)})
        GROUP BY kgp.kpi_group_id
      `
    ]);
    for (const r of monthGroupFacts) monthFactByGroup.set(r.kpi_group_id, num(r.sales));
    for (const r of todayGroupFacts) todayFactByGroup.set(r.kpi_group_id, num(r.sales));
  }

  const remDaysAvg =
    agents.length > 0
      ? Math.max(
          1,
          Math.round(agents.reduce((s, a) => s + a.remaining_working_days, 0) / agents.length)
        )
      : 1;

  return [...groupPlan.entries()]
    .map(([gid, g]) => {
      let monthFact = monthFactByGroup.get(gid) ?? 0;
      let todayFact = todayFactByGroup.get(gid) ?? 0;
      if (monthFact <= 0 && groupIds.length === 1) {
        monthFact = monthFactSum;
        todayFact = todayFactSum;
      }
      const todayPlan =
        remDaysAvg > 0 ? Math.max(0, g.plan - Math.max(0, monthFact - todayFact)) / remDaysAvg : 0;
      return {
        kpi_group_id: gid,
        name: g.name,
        code: g.code,
        agent_count: g.agents.size,
        month_plan_sum: g.plan,
        month_fact_sum: monthFact,
        month_execution_pct: executionPctFromPlanFact(g.plan, monthFact),
        today_plan_sum: todayPlan,
        today_fact_sum: todayFact,
        today_execution_pct: executionPctFromPlanFact(todayPlan, todayFact),
        remaining_sum: Math.max(0, g.plan - monthFact),
        status: statusFromDay({
          hasPlans: g.plan > 0,
          todayPlan,
          todayFact,
          isWorkingToday: true
        })
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
