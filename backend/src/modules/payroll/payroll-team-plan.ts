import { prisma } from "../../config/database";
import type { WorkdaysState } from "../tabel/workdays.service";
import { sumMetrics, ZERO_METRICS, type KpiMetrics } from "./payroll-kpi-fact.pure";
import { computeUserMonthPlan } from "./payroll-slot-plan";

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

export async function computeTeamMonthPlan(
  tenantId: number,
  userId: number,
  year: number,
  month: number,
  range: Range,
  timeZone: string,
  workdays: WorkdaysState
): Promise<{ total: KpiMetrics; byGroup: Map<number, KpiMetrics> }> {
  const ids = await teamAgentIds(tenantId, userId, range);
  const byGroup = new Map<number, KpiMetrics>();
  for (const id of ids) {
    const p = await computeUserMonthPlan(tenantId, id, year, month, range, timeZone, workdays);
    for (const [g, m] of p.byGroup) byGroup.set(g, sumMetrics([byGroup.get(g) ?? { ...ZERO_METRICS }, m]));
  }
  return { total: sumMetrics([...byGroup.values()]), byGroup };
}
