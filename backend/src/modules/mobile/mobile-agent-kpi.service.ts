import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  executionPctFromPlanFact,
  WORKING_KPI_PLAN_STATUSES
} from "../plans/plans.monitoring-aggregates";
import { getAgentMonthlyPlanCostSum } from "../plans/plans.agent-plan-sum";
import { getMobileAgentTimesheet } from "./mobile-agent-timesheet.service";
import {
  localTodayRange,
  workRegionDayRange,
  workRegionTodayKey
} from "./mobile-agent-sync.config.service";
import {
  buildKpiDailyRoutePlan,
  loadAgentWorkingDays
} from "./mobile-agent-kpi-daily-route";
import type {
  MobileAgentKpiGroupRow,
  MobileAgentKpiMetricBlock,
  MobileAgentKpiResult
} from "./mobile-agent-kpi.types";
import { loadAgentSlotOccupancyForMonth } from "../work-slots/work-slots.occupancy";
import {
  applyPlanShare,
  readSlotPlanPolicy,
  resolveSlotPlanShare
} from "../work-slots/work-slots.plan-policy";

export type {
  MobileAgentKpiGroupRow,
  MobileAgentKpiMetricBlock,
  MobileAgentKpiResult
} from "./mobile-agent-kpi.types";

function emptyMetrics(): MobileAgentKpiMetricBlock {
  return { cost: 0, count: 0, volume: 0, acb: 0, order_count: 0 };
}

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v instanceof Prisma.Decimal ? v.toString() : v);
}

function pickPrimaryMetric(plan: MobileAgentKpiMetricBlock): keyof MobileAgentKpiMetricBlock {
  if (plan.cost > 0) return "cost";
  if (plan.count > 0) return "count";
  if (plan.volume > 0) return "volume";
  if (plan.acb > 0) return "acb";
  if (plan.order_count > 0) return "order_count";
  return "cost";
}

function monthBounds(month: string): { year: number; monthNum: number; start: Date; end: Date; daysInMonth: number } {
  const [yy, mm] = month.split("-").map((x) => Number.parseInt(x, 10));
  const start = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(yy, mm, 1, 0, 0, 0, 0));
  const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return { year: yy, monthNum: mm, start, end, daysInMonth };
}

/** Agent KPI — web «Установка планов» + timesheet bilan bir xil manba. */
export async function getMobileAgentKpi(
  tenantId: number,
  userId: number,
  monthInput?: string
): Promise<MobileAgentKpiResult> {
  const todayKey = workRegionTodayKey();
  const month = (monthInput?.trim() || todayKey.slice(0, 7));
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("BAD_MONTH");

  const { year, monthNum, start: monthStart, end: monthEnd, daysInMonth } = monthBounds(month);
  const dayOfMonth = Number.parseInt(todayKey.slice(8, 10), 10);
  const isCurrentMonth = month === todayKey.slice(0, 7);
  const { start: todayStart, end: todayEnd } = isCurrentMonth
    ? localTodayRange()
    : workRegionDayRange(`${month}-${String(Math.min(dayOfMonth, daysInMonth)).padStart(2, "0")}`);

  const [user, planSum, targets, todayOrders, monthOrders, timesheet, storedResults] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id: userId, tenant_id: tenantId, role: "agent" },
        select: { id: true, name: true, code: true }
      }),
      getAgentMonthlyPlanCostSum(tenantId, userId, monthNum, year, WORKING_KPI_PLAN_STATUSES),
      prisma.salesKpiPlanTarget.findMany({
        where: {
          tenant_id: tenantId,
          user_id: userId,
          plan: {
            tenant_id: tenantId,
            month: monthNum,
            year,
            status: { in: [...WORKING_KPI_PLAN_STATUSES] },
            kpi_group: { is_active: true }
          }
        },
        select: {
          cost: true,
          count: true,
          volume: true,
          acb: true,
          order_count: true,
          plan: {
            select: {
              status: true,
              kpi_group_id: true,
              kpi_group: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  is_active: true,
                  _count: { select: { products: true } }
                }
              }
            }
          }
        },
        orderBy: { plan: { kpi_group: { sort_order: "asc" } } }
      }),
      prisma.order.aggregate({
        where: {
          tenant_id: tenantId,
          agent_id: userId,
          order_type: "order",
          created_at: { gte: todayStart, lte: todayEnd }
        },
        _sum: { total_sum: true },
        _count: true
      }),
      prisma.order.aggregate({
        where: {
          tenant_id: tenantId,
          agent_id: userId,
          order_type: "order",
          created_at: { gte: monthStart, lt: monthEnd }
        },
        _sum: { total_sum: true }
      }),
      getMobileAgentTimesheet(tenantId, userId, month).catch(() => null),
      prisma.kpiResult.findMany({
        where: { tenant_id: tenantId, user_id: userId, period_month: month },
        select: {
          metric: true,
          value: true,
          target: true,
          score: true,
          kpi_group_id: true,
          comment: true
        },
        orderBy: { id: "asc" }
      })
    ]);

  const groupIds = [...new Set(targets.map((t) => t.plan.kpi_group_id))];
  // Bir guruh uchun bir nechta plan bo‘lsa — bitta qator (approved ustun).
  const uniqueTargets = (() => {
    const map = new Map<number, (typeof targets)[number]>();
    const statusRank = (s: string) => (s === "approved" ? 2 : s === "pending_approval" ? 1 : 0);
    for (const t of targets) {
      const id = t.plan.kpi_group_id;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, t);
        continue;
      }
      const prevR = statusRank(prev.plan.status);
      const nextR = statusRank(t.plan.status);
      if (nextR > prevR) {
        map.set(id, t);
        continue;
      }
      if (nextR === prevR && num(t.cost) > num(prev.cost)) map.set(id, t);
    }
    return [...map.values()];
  })();
  const factByGroup = new Map<number, MobileAgentKpiMetricBlock>();
  const todayFactByGroup = new Map<number, MobileAgentKpiMetricBlock>();

  if (groupIds.length > 0) {
    const factRows = await prisma.$queryRaw<
      Array<{
        kpi_group_id: number;
        cost: Prisma.Decimal;
        count: Prisma.Decimal;
        volume: Prisma.Decimal;
        acb: bigint;
        order_count: bigint;
      }>
    >`
      SELECT
        kgp.kpi_group_id,
        COALESCE(SUM(oi.total), 0)::numeric(18,2) AS cost,
        COALESCE(SUM(oi.qty), 0)::numeric(18,2) AS count,
        COALESCE(SUM(oi.qty * COALESCE(p.volume_m3, 0)), 0)::numeric(18,2) AS volume,
        COUNT(DISTINCT o.client_id)::bigint AS acb,
        COUNT(DISTINCT o.id)::bigint AS order_count
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      JOIN kpi_group_products kgp ON kgp.product_id = oi.product_id
      WHERE o.tenant_id = ${tenantId}
        AND o.agent_id = ${userId}
        AND o.order_type = 'order'
        AND o.created_at >= ${monthStart}
        AND o.created_at < ${monthEnd}
        AND kgp.kpi_group_id IN (${Prisma.join(groupIds)})
      GROUP BY kgp.kpi_group_id
    `;
    for (const r of factRows) {
      factByGroup.set(r.kpi_group_id, {
        cost: num(r.cost),
        count: num(r.count),
        volume: num(r.volume),
        acb: Number(r.acb),
        order_count: Number(r.order_count)
      });
    }

    const todayFactRows = await prisma.$queryRaw<
      Array<{
        kpi_group_id: number;
        cost: Prisma.Decimal;
        count: Prisma.Decimal;
        volume: Prisma.Decimal;
        acb: bigint;
        order_count: bigint;
      }>
    >`
      SELECT
        kgp.kpi_group_id,
        COALESCE(SUM(oi.total), 0)::numeric(18,2) AS cost,
        COALESCE(SUM(oi.qty), 0)::numeric(18,2) AS count,
        COALESCE(SUM(oi.qty * COALESCE(p.volume_m3, 0)), 0)::numeric(18,2) AS volume,
        COUNT(DISTINCT o.client_id)::bigint AS acb,
        COUNT(DISTINCT o.id)::bigint AS order_count
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      JOIN kpi_group_products kgp ON kgp.product_id = oi.product_id
      WHERE o.tenant_id = ${tenantId}
        AND o.agent_id = ${userId}
        AND o.order_type = 'order'
        AND o.created_at >= ${todayStart}
        AND o.created_at <= ${todayEnd}
        AND kgp.kpi_group_id IN (${Prisma.join(groupIds)})
      GROUP BY kgp.kpi_group_id
    `;
    for (const r of todayFactRows) {
      todayFactByGroup.set(r.kpi_group_id, {
        cost: num(r.cost),
        count: num(r.count),
        volume: num(r.volume),
        acb: Number(r.acb),
        order_count: Number(r.order_count)
      });
    }
  }

  const todaySales = num(todayOrders._sum.total_sum);
  const monthFact = num(monthOrders._sum.total_sum);

  // Oy ichidagi kunlik savdo (carry-forward uchun).
  const monthDailySales = await prisma.$queryRaw<Array<{ day: Date; sales: Prisma.Decimal }>>`
    SELECT (timezone('Asia/Tashkent', o.created_at))::date AS day,
           COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      AND o.agent_id = ${userId}
      AND o.order_type = 'order'
      AND o.created_at >= ${monthStart}
      AND o.created_at < ${monthEnd}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const salesByDate = new Map<string, number>();
  for (const r of monthDailySales) {
    const key =
      r.day instanceof Date
        ? r.day.toISOString().slice(0, 10)
        : String(r.day).slice(0, 10);
    salesByDate.set(key, num(r.sales));
  }

  const workingDays = await loadAgentWorkingDays(tenantId, userId, year, monthNum);

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const planPolicy = readSlotPlanPolicy(tenantRow?.settings);
  const occupancy = await loadAgentSlotOccupancyForMonth(tenantId, [userId], monthStart, monthEnd);
  const shareInfo = resolveSlotPlanShare({
    policy: planPolicy,
    monthStart,
    monthEnd,
    workingDayKeys: workingDays,
    segments: occupancy.get(userId) ?? []
  });
  const effectivePlanSum = applyPlanShare(planSum, shareInfo.share);
  const routeWorkingDays = shareInfo.working_days_for_route;
  const monthPct = executionPctFromPlanFact(effectivePlanSum, monthFact);

  const routeAsOf =
    isCurrentMonth
      ? todayKey
      : month < todayKey.slice(0, 7)
        ? `${month}-${String(daysInMonth).padStart(2, "0")}`
        : `${month}-01`;
  const dailyRoute = buildKpiDailyRoutePlan({
    monthPlan: effectivePlanSum,
    year,
    monthNum,
    todayKey: routeAsOf,
    salesByDate,
    workingDays: routeWorkingDays
  });

  const planDaySum = dailyRoute.today_plan_sum;
  const basePlanDaySum = dailyRoute.base_day_plan;
  const todayPct = executionPctFromPlanFact(planDaySum, todaySales);

  const elapsedDays = isCurrentMonth
    ? Math.max(1, Math.min(dayOfMonth, daysInMonth))
    : daysInMonth;
  let forecastPct: number | null = null;
  if (effectivePlanSum > 0 && isCurrentMonth && elapsedDays > 0) {
    const projected = (monthFact / elapsedDays) * daysInMonth;
    forecastPct = executionPctFromPlanFact(effectivePlanSum, projected);
  }

  // Faqat faol KPI guruhlari (agentga plan orqali biriktirilgan).
  // is_active === true — Settings «Активный» bilan bir xil (inactive + active bir xil nom — turli id).
  const assignedActiveTargets = uniqueTargets.filter((t) => t.plan.kpi_group.is_active === true);

  // Agar guruhda agent ro‘yxati bo‘lsa — faqat shu agentlar uchun.
  // Ro‘yxat bo‘sh bo‘lsa — plan target yetarli (agentga oy uchun belgilangan).
  const groupIdsForAgents = assignedActiveTargets.map((t) => t.plan.kpi_group_id);
  const agentGroupLinks =
    groupIdsForAgents.length > 0
      ? await prisma.kpiGroupAgent.findMany({
          where: { kpi_group_id: { in: groupIdsForAgents } },
          select: { kpi_group_id: true, user_id: true }
        })
      : [];
  const groupsWithAgentList = new Set(agentGroupLinks.map((l) => l.kpi_group_id));
  const agentAllowedGroups = new Set(
    agentGroupLinks.filter((l) => l.user_id === userId).map((l) => l.kpi_group_id)
  );

  const visibleTargets = assignedActiveTargets.filter((t) => {
    const gid = t.plan.kpi_group_id;
    if (!groupsWithAgentList.has(gid)) return true;
    return agentAllowedGroups.has(gid);
  });

  const weightForVisible =
    visibleTargets.length > 0 ? Math.round((100 / visibleTargets.length) * 10) / 10 : null;

  const remDays = Math.max(0, dailyRoute.remaining_working_days);

  const kpiGroups: MobileAgentKpiGroupRow[] = visibleTargets.map((t) => {
    const g = t.plan.kpi_group;
    const plan: MobileAgentKpiMetricBlock = {
      cost: num(t.cost),
      count: num(t.count),
      volume: num(t.volume),
      acb: num(t.acb),
      order_count: t.order_count
    };
    const hasProducts = g._count.products > 0;
    let fact = factByGroup.get(g.id) ?? emptyMetrics();
    let todayFact = todayFactByGroup.get(g.id) ?? emptyMetrics();
    // Mahsulot bog‘lanmagan yagona guruh — umumiy savdo faktini ko‘rsatamiz.
    if (!hasProducts && visibleTargets.length === 1 && plan.cost > 0) {
      fact = { ...fact, cost: monthFact };
      todayFact = { ...todayFact, cost: todaySales };
    }
    const primary = pickPrimaryMetric(plan);
    const planPrimary = plan[primary];
    const factPrimary = fact[primary];
    const todayFactPrimary = todayFact[primary];
    const pct = executionPctFromPlanFact(planPrimary, factPrimary);
    const stored = storedResults.find((r) => r.kpi_group_id === g.id);
    const remaining =
      planPrimary > 0 ? Math.max(0, planPrimary - factPrimary) : null;
    // Bugungi marshrut/kunlik plan: (oylik − bugungacha fakt) / qolgan ish kunlari.
    const factBeforeToday = Math.max(0, factPrimary - todayFactPrimary);
    const monthRemBeforeToday = Math.max(0, planPrimary - factBeforeToday);
    const todayPlanPrimary = remDays > 0 ? monthRemBeforeToday / remDays : 0;
    const todayPctGroup = executionPctFromPlanFact(todayPlanPrimary, todayFactPrimary);
    const todayRemainingPrimary = Math.max(0, todayPlanPrimary - todayFactPrimary);
    let hint: string | null = null;
    if (!hasProducts && visibleTargets.length > 1) {
      hint = "SKU bog‘lanmagan — fakt guruh bo‘yicha yo‘q";
    } else if (remaining != null && remaining > 0 && primary === "cost") {
      hint = `до плана: ${Math.round(remaining).toLocaleString("ru-RU").replace(/\u00A0/g, " ")}`;
    } else if (hasProducts) {
      hint = `${g._count.products} SKU`;
    }
    return {
      kpi_group_id: g.id,
      name: g.name,
      code: g.code,
      is_active: g.is_active === true,
      plan_status: t.plan.status,
      product_count: g._count.products,
      plan,
      fact,
      primary_metric: primary,
      execution_pct: pct,
      remaining_primary: remaining,
      today_plan_primary: todayPlanPrimary,
      today_fact_primary: todayFactPrimary,
      today_execution_pct: todayPctGroup,
      today_remaining_primary: todayRemainingPrimary,
      weight_pct: weightForVisible,
      score: stored?.score != null ? num(stored.score) : null,
      hint
    };
  });

  // Bugungi hajm (qty)
  const todayQtyRows = await prisma.$queryRaw<Array<{ qty: Prisma.Decimal }>>`
    SELECT COALESCE(SUM(oi.qty), 0)::numeric(18,3) AS qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
    WHERE o.tenant_id = ${tenantId}
      AND o.agent_id = ${userId}
      AND o.order_type = 'order'
      AND o.created_at >= ${todayStart}
      AND o.created_at <= ${todayEnd}
  `;
  const volumeQty = num(todayQtyRows[0]?.qty);

  const visitsToday = await prisma.agentVisit.count({
    where: {
      tenant_id: tenantId,
      agent_id: userId,
      checked_in_at: { gte: todayStart, lte: todayEnd }
    }
  });

  // SKU focus — birinchi mahsulotli guruhning count metri
  const skuGroup = kpiGroups.find((g) => g.product_count > 0 && g.plan.count > 0);
  const skuFocus = skuGroup
    ? {
        fact: skuGroup.fact.count,
        plan: skuGroup.plan.count,
        label: skuGroup.name
      }
    : null;

  // Oxirgi 7 kun dinamikasi
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const week: MobileAgentKpiResult["week"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setUTCDate(d.getUTCDate() - i);
    // Work-region calendar key (+5h aligned via localTodayRange / same as sales map).
    const wr = new Date(d.getTime() + 5 * 60 * 60 * 1000);
    const key = wr.toISOString().slice(0, 10);
    const sales = salesByDate.get(key) ?? 0;
    const dayRow = dailyRoute.days.find((x) => x.date === key);
    const dayPlan = dayRow?.plan_sum ?? basePlanDaySum;
    const wd = wr.getUTCDay();
    week.push({
      date: key,
      weekday: wd === 0 ? 7 : wd,
      sales_sum: sales,
      plan_sum: dayPlan,
      execution_pct: executionPctFromPlanFact(dayPlan, sales)
    });
  }

  let timesheetBlock: MobileAgentKpiResult["timesheet"] = {
    coefficient: null,
    active_days: 0,
    excused_days: 0,
    inactive_days: 0,
    off_days: 0,
    worked_days: 0,
    sales_total: 0,
    visits_total: 0
  };
  if (timesheet) {
    const t = timesheet.totals;
    const excused = t.sick_days + t.vacation_days + t.trip_days;
    const denom = t.worked_days + t.absent_days + excused;
    timesheetBlock = {
      coefficient: denom > 0 ? Math.round((t.worked_days / denom) * 100) / 100 : null,
      active_days: t.active_days,
      excused_days: excused,
      inactive_days: t.absent_days,
      off_days: t.holiday_days,
      worked_days: t.worked_days,
      sales_total: t.sales_total,
      visits_total: t.visits_total
    };
  }

  return {
    period: {
      month,
      today: todayKey,
      year,
      month_num: monthNum,
      days_in_month: daysInMonth,
      day_of_month: dayOfMonth
    },
    agent: {
      id: userId,
      name: user?.name ?? "",
      code: user?.code ?? null
    },
    today: {
      sales_sum: todaySales,
      plan_day_sum: planDaySum,
      base_plan_day_sum: basePlanDaySum,
      execution_pct: todayPct,
      remaining_sum: Math.max(0, planDaySum - todaySales),
      visits: visitsToday,
      orders_count: todayOrders._count,
      volume_qty: volumeQty,
      sku_focus: skuFocus,
      vs_yesterday_pct: dailyRoute.vs_yesterday_pct
    },
    month: {
      plan_sum: effectivePlanSum,
      fact_sum: monthFact,
      execution_pct: monthPct,
      remaining_sum: Math.max(0, effectivePlanSum - monthFact),
      forecast_pct: forecastPct,
      has_plans: effectivePlanSum > 0 || targets.length > 0
    },
    daily_route: dailyRoute,
    kpi_groups: kpiGroups,
    week,
    timesheet: timesheetBlock,
    stored_results: storedResults.map((r) => ({
      metric: r.metric,
      value: num(r.value),
      target: r.target != null ? num(r.target) : null,
      score: r.score != null ? num(r.score) : null,
      kpi_group_id: r.kpi_group_id,
      comment: r.comment
    })),
    notes: {
      plan_source:
        "План из KPI «Установка планов»; kunlik reja = qoldiq / qolgan ish kunlari (carry-forward).",
      bonus_available: false
    }
  };
}
