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

export type PlanTargetRow = {
  plan_id: number;
  user_id: number;
  work_slot_id: number | null;
  cost: unknown;
  count: unknown;
  volume: unknown;
  acb: unknown;
  order_count: number;
};

/** Oy rejalari, o'rinlar va targetlar — barcha xodimlar uchun bir marta. */
export type PlanMonthCache = {
  approved: Array<{ id: number; kpi_group_id: number }>;
  pendingCount: Map<number, number>;
  slotIdsByUser: Map<number, number[]>;
  holdersBySlot: Map<number, Array<{ user_id: number; started_at: Date; ended_at: Date | null }>>;
  slotType: Map<number, string>;
  targets: PlanTargetRow[];
};

const linkWindow = (range: Range) => ({
  started_at: { lt: range.to },
  OR: [{ ended_at: null }, { ended_at: { gt: range.from } }]
});

export async function loadPlanMonthCache(tenantId: number, year: number, month: number, range: Range): Promise<PlanMonthCache> {
  const plans = await prisma.salesKpiPlan.findMany({
    where: { tenant_id: tenantId, year, month },
    select: { id: true, kpi_group_id: true, status: true }
  });
  const approved = plans.filter((p) => p.status === "approved").map((p) => ({ id: p.id, kpi_group_id: p.kpi_group_id }));
  const pendingIds = plans.filter((p) => p.status !== "approved").map((p) => p.id);
  const planIds = approved.map((p) => p.id);
  const [links, pendingRows, targets] = await Promise.all([
    prisma.slotUserLink.findMany({
      where: { tenant_id: tenantId, ...linkWindow(range) },
      select: { user_id: true, slot_id: true, started_at: true, ended_at: true },
      orderBy: { started_at: "asc" }
    }),
    pendingIds.length
      ? prisma.salesKpiPlanTarget.findMany({ where: { plan_id: { in: pendingIds } }, select: { user_id: true } })
      : Promise.resolve([] as Array<{ user_id: number }>),
    planIds.length
      ? prisma.salesKpiPlanTarget.findMany({
          where: { plan_id: { in: planIds } },
          select: { plan_id: true, user_id: true, work_slot_id: true, cost: true, count: true, volume: true, acb: true, order_count: true }
        })
      : Promise.resolve([] as PlanTargetRow[])
  ]);
  const slotIds = [...new Set(links.map((l) => l.slot_id))];
  const slots = slotIds.length
    ? await prisma.workSlot.findMany({ where: { id: { in: slotIds } }, select: { id: true, slot_type: true } })
    : [];
  const pendingCount = new Map<number, number>();
  for (const r of pendingRows) pendingCount.set(r.user_id, (pendingCount.get(r.user_id) ?? 0) + 1);
  const slotIdsByUser = new Map<number, number[]>();
  const holdersBySlot = new Map<number, Array<{ user_id: number; started_at: Date; ended_at: Date | null }>>();
  for (const l of links) {
    const mine = slotIdsByUser.get(l.user_id);
    if (!mine) slotIdsByUser.set(l.user_id, [l.slot_id]);
    else if (!mine.includes(l.slot_id)) mine.push(l.slot_id);
    const row = { user_id: l.user_id, started_at: l.started_at, ended_at: l.ended_at };
    const holders = holdersBySlot.get(l.slot_id);
    if (holders) holders.push(row);
    else holdersBySlot.set(l.slot_id, [row]);
  }
  return { approved, pendingCount, slotIdsByUser, holdersBySlot, slotType: new Map(slots.map((s) => [s.id, s.slot_type])), targets };
}

/**
 * Xodimning oy rejasi KPI guruhlari bo'yicha (faqat `approved` rejalar).
 * O'ringa bog'liq targetlar ishlangan kunlar ulushida bo'linadi (jami 1×).
 * `cache` berilsa oy ma'lumoti qayta so'ralmaydi.
 */
export async function computeUserMonthPlan(
  tenantId: number,
  userId: number,
  year: number,
  month: number,
  range: Range,
  timeZone: string,
  workdays: WorkdaysState,
  cache?: PlanMonthCache
): Promise<UserPlanResult> {
  const c = cache ?? (await loadPlanMonthCache(tenantId, year, month, range));
  const warnings = new Set<string>();
  const byGroup = new Map<number, KpiMetrics>();
  const slotsOut: UserPlanResult["slots"] = [];
  const pending = c.pendingCount.get(userId) ?? 0;
  if (pending > 0) warnings.add("pending_plan");
  if (!c.approved.length) {
    return { byGroup, total: { ...ZERO_METRICS }, slots: slotsOut, warnings: [...warnings], pending_plans: pending };
  }
  const planGroup = new Map(c.approved.map((p) => [p.id, p.kpi_group_id]));
  const planIds = c.approved.map((p) => p.id);
  const slotIds = c.slotIdsByUser.get(userId) ?? [];
  const handledPlanSlot = new Set<string>();
  const monthStart = ymdInTimeZone(range.from, timeZone);

  for (const slotId of slotIds) {
    const links = c.holdersBySlot.get(slotId) ?? [];
    const holders: SlotHolder[] = links.map((l) => ({
      userId: l.user_id,
      startYmd: l.started_at < range.from ? monthStart : ymdInTimeZone(l.started_at, timeZone),
      endYmdExcl: l.ended_at && l.ended_at < range.to ? ymdInTimeZone(l.ended_at, timeZone) : null
    }));
    const slotDays = listCalendarWorkingDays(workdays, c.slotType.get(slotId) ?? null, null, year, month);
    const holderIds = [...new Set(holders.map((h) => h.userId))];
    const targets = c.targets.filter(
      (x) => holderIds.includes(x.user_id) && (x.work_slot_id == null || x.work_slot_id === slotId)
    );

    for (const planId of planIds) {
      const t = targets.filter((x) => x.plan_id === planId);
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

  for (const t of c.targets) {
    if (t.user_id !== userId || handledPlanSlot.has(`${t.plan_id}:${userId}`)) continue;
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
