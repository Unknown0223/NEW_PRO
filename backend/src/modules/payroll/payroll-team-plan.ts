import { prisma } from "../../config/database";
import type { WorkdaysState } from "../tabel/workdays.service";
import { sumMetrics, ZERO_METRICS, type KpiMetrics } from "./payroll-kpi-fact.pure";
import { computeUserMonthPlan, loadPlanMonthCache, type PlanMonthCache } from "./payroll-slot-plan";

type Range = { from: Date; to: Date };

const activeIn = (range: Range) => ({
  started_at: { lt: range.to },
  OR: [{ ended_at: null }, { ended_at: { gt: range.from } }]
});

/** Supervizor jamoasi: nazoratdagi o'rinlar egalari, bo'lmasa `supervisor_user_id` bo'yicha agentlar. */
export async function teamAgentIds(tenantId: number, userId: number, range: Range): Promise<number[]> {
  const links = await prisma.slotUserLink.findMany({
    where: { tenant_id: tenantId, user_id: userId, ...activeIn(range) },
    select: { slot: { select: { supervisee_agent_slot_ids: true } } }
  });
  const slotIds = [...new Set(links.flatMap((l) => l.slot.supervisee_agent_slot_ids))];
  if (slotIds.length) {
    const holders = await prisma.slotUserLink.findMany({
      where: { tenant_id: tenantId, slot_id: { in: slotIds }, ...activeIn(range) },
      select: { user_id: true }
    });
    return [...new Set(holders.map((h) => h.user_id))];
  }
  const agents = await prisma.user.findMany({
    where: { tenant_id: tenantId, supervisor_user_id: userId, role: "agent" },
    select: { id: true }
  });
  return agents.map((a) => a.id);
}

/**
 * Supervayzer jamoani oyning qancha qismida boshqargani (ish o'rni oynalari bo'yicha, 0..1).
 * Jamoa fakti ham shu oynalar bilan olinadi — reja shu ulushga keltiriladi.
 */
async function supervisionCoverage(tenantId: number, userId: number, range: Range): Promise<number> {
  const links = await prisma.slotUserLink.findMany({
    where: { tenant_id: tenantId, user_id: userId, ...activeIn(range) },
    select: { started_at: true, ended_at: true, slot: { select: { supervisee_agent_slot_ids: true } } }
  });
  const spans = links
    .filter((l) => l.slot.supervisee_agent_slot_ids.length > 0)
    .map((l) => [Math.max(l.started_at.getTime(), range.from.getTime()), Math.min(l.ended_at?.getTime() ?? range.to.getTime(), range.to.getTime())] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  if (!spans.length) return 1;
  let covered = 0;
  let curA = spans[0]![0];
  let curB = spans[0]![1];
  for (const [a, b] of spans.slice(1)) {
    if (a <= curB) curB = Math.max(curB, b);
    else {
      covered += curB - curA;
      curA = a;
      curB = b;
    }
  }
  covered += curB - curA;
  return Math.min(1, covered / (range.to.getTime() - range.from.getTime()));
}

const scale = (m: KpiMetrics, k: number): KpiMetrics =>
  k >= 1
    ? m
    : {
        cost: Math.round(m.cost * k * 100) / 100,
        count: Math.round(m.count * k * 100) / 100,
        volume: Math.round(m.volume * k * 100) / 100,
        acb: Math.round(m.acb * k),
        order_count: Math.round(m.order_count * k)
      };

export async function computeTeamMonthPlan(
  tenantId: number,
  userId: number,
  year: number,
  month: number,
  range: Range,
  timeZone: string,
  workdays: WorkdaysState,
  cache?: PlanMonthCache
): Promise<{ total: KpiMetrics; byGroup: Map<number, KpiMetrics>; coverage: number }> {
  const ids = await teamAgentIds(tenantId, userId, range);
  const coverage = await supervisionCoverage(tenantId, userId, range);
  const planCache = cache ?? (await loadPlanMonthCache(tenantId, year, month, range));
  const byGroup = new Map<number, KpiMetrics>();
  for (const id of ids) {
    const p = await computeUserMonthPlan(tenantId, id, year, month, range, timeZone, workdays, planCache);
    for (const [g, m] of p.byGroup) byGroup.set(g, sumMetrics([byGroup.get(g) ?? { ...ZERO_METRICS }, m]));
  }
  for (const [g, m] of byGroup) byGroup.set(g, scale(m, coverage));
  return { total: sumMetrics([...byGroup.values()]), byGroup, coverage };
}
