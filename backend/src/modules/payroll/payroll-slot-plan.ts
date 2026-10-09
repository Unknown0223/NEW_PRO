import { prisma } from "../../config/database";
import type { WorkdaysState } from "../tabel/workdays.service";
import { listCalendarWorkingDays, ymdInTimeZone } from "../../lib/workday-calendar";
import { sumMetrics, ZERO_METRICS, type KpiMetrics } from "./payroll-kpi-fact.pure";
import { splitSlotPlan, type SlotHolder } from "./payroll-slot-plan.pure";

type Range = { from: Date; to: Date };

export type UserPlanResult = {
  byGroup: Map<number, KpiMetrics>;
  total: KpiMetrics;
  slots: Array<{ slot_id: number; days: number; slot_days: number; source: string; owner_user_id: number | null }>;
  warnings: string[];
  pending_plans: number;
};

function targetMetrics(t: { cost: unknown; count: unknown; volume: unknown; acb: unknown; order_count: number }): KpiMetrics {
  return {
    cost: Number(t.cost),
    count: Number(t.count),
    volume: Number(t.volume),
    acb: Number(t.acb),
    order_count: t.order_count
  };
}

function addTo(map: Map<number, KpiMetrics>, groupId: number, m: KpiMetrics) {
  map.set(groupId, sumMetrics([map.get(groupId) ?? { ...ZERO_METRICS }, m]));
}

/**
 * Xodimning oy rejasi KPI guruhlari bo'yicha (faqat `approved` rejalar).
 * O'ringa bog'liq targetlar ishlangan kunlar ulushida bo'linadi (jami 1×).
 */
export async function computeUserMonthPlan(
  tenantId: number,
  userId: number,
  year: number,
  month: number,
  range: Range,
  timeZone: string,
  workdays: WorkdaysState
): Promise<UserPlanResult> {
  const warnings = new Set<string>();
  const byGroup = new Map<number, KpiMetrics>();
  const slotsOut: UserPlanResult["slots"] = [];

  const plans = await prisma.salesKpiPlan.findMany({
    where: { tenant_id: tenantId, year, month },
    select: { id: true, kpi_group_id: true, status: true }
  });
  const approved = plans.filter((p) => p.status === "approved");
  const pendingIds = plans.filter((p) => p.status !== "approved").map((p) => p.id);
  const pending = pendingIds.length
    ? await prisma.salesKpiPlanTarget.count({ where: { plan_id: { in: pendingIds }, user_id: userId } })
    : 0;
  if (pending > 0) warnings.add("pending_plan");
  if (!approved.length) {
    return { byGroup, total: { ...ZERO_METRICS }, slots: slotsOut, warnings: [...warnings], pending_plans: pending };
  }
  const planGroup = new Map(approved.map((p) => [p.id, p.kpi_group_id]));
  const planIds = approved.map((p) => p.id);

  const myLinks = await prisma.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      user_id: userId,
      started_at: { lt: range.to },
      OR: [{ ended_at: null }, { ended_at: { gt: range.from } }]
    },
    select: { slot_id: true }
  });
  const slotIds = [...new Set(myLinks.map((l) => l.slot_id))];
  const handledPlanSlot = new Set<string>();

  for (const slotId of slotIds) {
    const slot = await prisma.workSlot.findFirst({ where: { id: slotId }, select: { slot_type: true } });
    const links = await prisma.slotUserLink.findMany({
      where: {
        tenant_id: tenantId,
        slot_id: slotId,
        started_at: { lt: range.to },
        OR: [{ ended_at: null }, { ended_at: { gt: range.from } }]
      },
      select: { user_id: true, started_at: true, ended_at: true },
      orderBy: { started_at: "asc" }
    });
    const monthStart = ymdInTimeZone(range.from, timeZone);
    const holders: SlotHolder[] = links.map((l) => ({
      userId: l.user_id,
      startYmd: l.started_at < range.from ? monthStart : ymdInTimeZone(l.started_at, timeZone),
      endYmdExcl: l.ended_at && l.ended_at < range.to ? ymdInTimeZone(l.ended_at, timeZone) : null
    }));
    const slotDays = listCalendarWorkingDays(workdays, slot?.slot_type ?? null, null, year, month);
    const holderIds = [...new Set(holders.map((h) => h.userId))];

    const targets = await prisma.salesKpiPlanTarget.findMany({
      where: {
        plan_id: { in: planIds },
        OR: [{ work_slot_id: slotId }, { user_id: { in: holderIds } }]
      },
      select: { plan_id: true, user_id: true, work_slot_id: true, cost: true, count: true, volume: true, acb: true, order_count: true }
    });

    for (const planId of planIds) {
      const t = targets.filter(
        (x) => x.plan_id === planId && holderIds.includes(x.user_id) && (x.work_slot_id == null || x.work_slot_id === slotId)
      );
      if (!t.length) continue;
      const tm = new Map<number, KpiMetrics>();
      for (const x of t) tm.set(x.user_id, targetMetrics(x));
      const split = splitSlotPlan({ slotWorkingDays: slotDays, holders, targets: tm });
      split.warnings.forEach((w) => warnings.add(w));
      const mine = split.shares.get(userId);
      handledPlanSlot.add(`${planId}:${userId}`);
      if (!mine) continue;
      addTo(byGroup, planGroup.get(planId)!, mine.plan);
      slotsOut.push({
        slot_id: slotId,
        days: mine.days,
        slot_days: mine.slot_days,
        source: mine.source,
        owner_user_id: split.ownerUserId
      });
    }
  }

  const own = await prisma.salesKpiPlanTarget.findMany({
    where: { plan_id: { in: planIds }, user_id: userId },
    select: { plan_id: true, cost: true, count: true, volume: true, acb: true, order_count: true }
  });
  for (const t of own) {
    if (handledPlanSlot.has(`${t.plan_id}:${userId}`)) continue;
    addTo(byGroup, planGroup.get(t.plan_id)!, targetMetrics(t));
  }

  return {
    byGroup,
    total: sumMetrics([...byGroup.values()]),
    slots: slotsOut,
    warnings: [...warnings],
    pending_plans: pending
  };
}
