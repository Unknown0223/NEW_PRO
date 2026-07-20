import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getWorkdaysState } from "../tabel/workdays.service";
import {
  buildKpiDailyRoutePlan,
  listAgentWorkingDaysInMonth
} from "../mobile/mobile-agent-kpi-daily-route";
import { workRegionDayRange, workRegionTodayKey } from "../mobile/mobile-agent-sync.config.service";
import { executionPctFromPlanFact, WORKING_KPI_PLAN_STATUSES } from "./plans.monitoring-aggregates";
import type { DailyKpiDayMatrixQuery } from "./plans.daily-kpi.schema";
import { fallbackWorkdaysState, monthBounds, sectionLinks } from "./plans.daily-kpi.helpers";

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v instanceof Prisma.Decimal ? v.toString() : v);
}

function parseDay(day: string): { year: number; month: number; dayNum: number } {
  const [y, m, d] = day.split("-").map((x) => Number.parseInt(x, 10));
  return { year: y, month: m, dayNum: d };
}

export type DailyKpiCell = {
  day_plan: number;
  sales: number;
  returns: number;
  fact: number;
  execution_pct: number | null;
};

export type DailyKpiDayMatrixResult = {
  day: string;
  period: { month: string; year: number; month_num: number; today: string };
  trade_directions: Array<{ id: number; name: string; code: string | null }>;
  direction_id: number | null;
  kpi_groups: Array<{ kpi_group_id: number; name: string; code: string | null }>;
  agents: Array<{
    agent_id: number;
    name: string;
    /** Smart / agent kodi (`users.code`) */
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
  links: ReturnType<typeof sectionLinks>;
};

/**
 * Kun bo‘yicha agent × KPI jadvali:
 * plan / savdo / возврат / факт / %.
 */
export async function getDailyKpiDayMatrix(
  tenantId: number,
  query: DailyKpiDayMatrixQuery
): Promise<DailyKpiDayMatrixResult> {
  const dayKey = query.day;
  const { year, month } = parseDay(dayKey);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const todayKey = workRegionTodayKey();
  const { start: monthStart, end: monthEnd } = monthBounds(year, month);
  const { start: dayStart, end: dayEnd } = workRegionDayRange(dayKey);

  const directions = await prisma.tradeDirection.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true }
  });
  const directionId = query.direction_id ?? directions[0]?.id ?? null;

  const empty = (): DailyKpiDayMatrixResult => ({
    day: dayKey,
    period: { month: monthKey, year, month_num: month, today: todayKey },
    trade_directions: directions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null })),
    direction_id: directionId,
    kpi_groups: [],
    agents: [],
    totals: {
      agents: 0,
      day_plan_sum: 0,
      sales_sum: 0,
      returns_sum: 0,
      fact_sum: 0,
      execution_pct: null
    },
    links: sectionLinks(month, year, directionId)
  });

  if (directionId == null) return empty();

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
      user: { tenant_id: tenantId, role: "agent", is_active: true }
    },
    select: {
      user_id: true,
      cost: true,
      user: { select: { id: true, name: true, code: true, branch: true } },
      plan: {
        select: {
          kpi_group_id: true,
          kpi_group: { select: { id: true, name: true, code: true } }
        }
      }
    }
  });

  if (targetRows.length === 0) {
    return { ...empty(), trade_directions: directions.map((d) => ({ ...d, code: d.code ?? null })) };
  }

  const planByAgentGroup = new Map<string, number>();
  const agentMeta = new Map<
    number,
    { id: number; name: string; code: string | null; branch: string | null }
  >();
  const groupMeta = new Map<number, { id: number; name: string; code: string | null }>();

  for (const t of targetRows) {
    const gid = t.plan.kpi_group_id;
    const key = `${t.user_id}:${gid}`;
    planByAgentGroup.set(key, (planByAgentGroup.get(key) ?? 0) + num(t.cost));
    if (!agentMeta.has(t.user_id)) {
      agentMeta.set(t.user_id, {
        id: t.user.id,
        name: t.user.name,
        code: t.user.code,
        branch: t.user.branch
      });
    }
    if (!groupMeta.has(gid)) {
      groupMeta.set(gid, {
        id: t.plan.kpi_group.id,
        name: t.plan.kpi_group.name,
        code: t.plan.kpi_group.code
      });
    }
  }

  const agentIds = [...agentMeta.keys()];
  const groupIds = [...groupMeta.keys()];

  let workdaysState;
  try {
    workdaysState = await getWorkdaysState(tenantId);
  } catch {
    workdaysState = fallbackWorkdaysState();
  }

  const salesByAgentGroupDay = new Map<string, Map<string, number>>();
  const daySales = new Map<string, number>();
  const dayReturns = new Map<string, number>();

  if (agentIds.length > 0 && groupIds.length > 0) {
    const [salesRows, returnRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{ agent_id: number; kpi_group_id: number; day: string; sales: Prisma.Decimal }>
      >`
        SELECT o.agent_id,
               kgp.kpi_group_id,
               to_char((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
               COALESCE(SUM(oi.total), 0)::numeric(18,2) AS sales
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
        JOIN kpi_group_products kgp ON kgp.product_id = oi.product_id
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND o.order_type = 'order'
          AND o.created_at >= ${monthStart}
          AND o.created_at < ${monthEnd}
          AND kgp.kpi_group_id IN (${Prisma.join(groupIds)})
        GROUP BY o.agent_id, kgp.kpi_group_id, 3
      `,
      prisma.$queryRaw<
        Array<{ agent_id: number; kpi_group_id: number; returns: Prisma.Decimal }>
      >`
        SELECT o.agent_id,
               kgp.kpi_group_id,
               COALESCE(SUM(
                 COALESCE(srl.paid_qty, GREATEST(srl.qty - COALESCE(srl.bonus_qty, 0), 0))
                 * COALESCE(oi.price, 0)
               ), 0)::numeric(18,2) AS returns
        FROM sales_returns sr
        JOIN orders o ON o.id = sr.order_id AND o.tenant_id = ${tenantId}
        JOIN sales_return_lines srl ON srl.return_id = sr.id
        JOIN kpi_group_products kgp ON kgp.product_id = srl.product_id
        LEFT JOIN LATERAL (
          SELECT oi0.price
          FROM order_items oi0
          WHERE oi0.order_id = sr.order_id
            AND oi0.product_id = srl.product_id
            AND oi0.is_bonus = false
          ORDER BY oi0.id
          LIMIT 1
        ) oi ON true
        WHERE sr.tenant_id = ${tenantId}
          AND sr.status = 'posted'
          AND sr.created_at >= ${dayStart}
          AND sr.created_at <= ${dayEnd}
          AND o.agent_id IN (${Prisma.join(agentIds)})
          AND kgp.kpi_group_id IN (${Prisma.join(groupIds)})
        GROUP BY o.agent_id, kgp.kpi_group_id
      `
    ]);

    for (const r of salesRows) {
      const d = String(r.day).slice(0, 10);
      const key = `${r.agent_id}:${r.kpi_group_id}`;
      let map = salesByAgentGroupDay.get(key);
      if (!map) {
        map = new Map();
        salesByAgentGroupDay.set(key, map);
      }
      map.set(d, num(r.sales));
      if (d === dayKey) daySales.set(key, num(r.sales));
    }
    for (const r of returnRows) {
      dayReturns.set(`${r.agent_id}:${r.kpi_group_id}`, num(r.returns));
    }

    // Guruhda SKU yo‘q / bog‘lanmagan: agent kunlik savdosini plan ulushi bo‘yicha taqsimlash
    const agentDayTotals = await prisma.$queryRaw<
      Array<{ agent_id: number; day: string; sales: Prisma.Decimal }>
    >`
      SELECT o.agent_id,
             to_char((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.agent_id IN (${Prisma.join(agentIds)})
        AND o.order_type = 'order'
        AND o.created_at >= ${monthStart}
        AND o.created_at < ${monthEnd}
      GROUP BY o.agent_id, 2
    `;
    const agentDayMap = new Map<string, number>();
    for (const r of agentDayTotals) {
      const d = String(r.day).slice(0, 10);
      agentDayMap.set(`${r.agent_id}:${d}`, num(r.sales));
    }

    for (const agentId of agentIds) {
      let scopedDay = 0;
      for (const gid of groupIds) scopedDay += daySales.get(`${agentId}:${gid}`) ?? 0;
      if (scopedDay > 0) continue;

      const agentPlanTotal = groupIds.reduce(
        (s, gid) => s + (planByAgentGroup.get(`${agentId}:${gid}`) ?? 0),
        0
      );
      if (agentPlanTotal <= 0) continue;

      // Oy kunlari bo‘yicha ham taqsimlash (carry-forward uchun)
      const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
      for (const [adKey, salesVal] of agentDayMap) {
        if (!adKey.startsWith(`${agentId}:`)) continue;
        const d = adKey.slice(String(agentId).length + 1);
        if (!d.startsWith(monthPrefix)) continue;
        for (const gid of groupIds) {
          const key = `${agentId}:${gid}`;
          const share = (planByAgentGroup.get(key) ?? 0) / agentPlanTotal;
          const part = salesVal * share;
          let map = salesByAgentGroupDay.get(key);
          if (!map) {
            map = new Map();
            salesByAgentGroupDay.set(key, map);
          }
          map.set(d, (map.get(d) ?? 0) + part);
          if (d === dayKey) daySales.set(key, (daySales.get(key) ?? 0) + part);
        }
      }
    }
  }

  const kpi_groups = [...groupMeta.values()]
    .map((g) => ({ kpi_group_id: g.id, name: g.name, code: g.code }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const agents = [...agentMeta.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((agent) => {
      const workingDays = listAgentWorkingDaysInMonth(workdaysState, year, month, agent.id);
      const cells: Record<string, DailyKpiCell> = {};
      for (const g of kpi_groups) {
        const key = `${agent.id}:${g.kpi_group_id}`;
        const monthPlan = planByAgentGroup.get(key) ?? 0;
        const salesMap = salesByAgentGroupDay.get(key) ?? new Map();
        const route = buildKpiDailyRoutePlan({
          monthPlan,
          year,
          monthNum: month,
          todayKey: dayKey,
          salesByDate: salesMap,
          workingDays
        });
        const dayRow = route.days.find((d) => d.date === dayKey);
        const dayPlan = dayRow?.plan_sum ?? 0;
        const sales = daySales.get(key) ?? salesMap.get(dayKey) ?? 0;
        const returns = dayReturns.get(key) ?? 0;
        const fact = Math.max(0, sales - returns);
        cells[String(g.kpi_group_id)] = {
          day_plan: dayPlan,
          sales,
          returns,
          fact,
          execution_pct: executionPctFromPlanFact(dayPlan, fact)
        };
      }
      return {
        agent_id: agent.id,
        name: agent.name,
        code: agent.code,
        branch: agent.branch,
        cells
      };
    });

  let dayPlanSum = 0;
  let salesSum = 0;
  let returnsSum = 0;
  let factSum = 0;
  for (const a of agents) {
    for (const c of Object.values(a.cells)) {
      dayPlanSum += c.day_plan;
      salesSum += c.sales;
      returnsSum += c.returns;
      factSum += c.fact;
    }
  }

  return {
    day: dayKey,
    period: { month: monthKey, year, month_num: month, today: todayKey },
    trade_directions: directions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null })),
    direction_id: directionId,
    kpi_groups,
    agents,
    totals: {
      agents: agents.length,
      day_plan_sum: dayPlanSum,
      sales_sum: salesSum,
      returns_sum: returnsSum,
      fact_sum: factSum,
      execution_pct: executionPctFromPlanFact(dayPlanSum, factSum)
    },
    links: sectionLinks(month, year, directionId)
  };
}
