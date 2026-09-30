import { prisma } from "../../config/database";
import { tenantMonthRangeUtc } from "../../lib/workday-calendar";
import { loadTenantTimezone } from "../tenant-settings/tenant-timezone";
import { markPayrollDirty } from "./payroll.dirty";
import { teamAgentIds } from "./payroll-team-plan";
import { RES_ITEMS, RES_KPI_FORMULA_BY_ROLE } from "./payroll.preset.pure";

export type ResAssignResult = {
  year: number;
  month: number;
  assigned: number;
  users: number;
  no_groups: number;
  extra_groups: number;
};

const KPI_KEYS = ["kpi1", "kpi2", "kpi3", "kpi4"];

/**
 * «KPI по группе» biriktirmalari: agent — o'z KPI guruhlari, СВР — jamoa agentlari guruhlari;
 * guruhlar tartibi (sort_order) bo'yicha KPI 1…4 ga. Qo'lda qilingan biriktirmalar saqlanadi.
 */
export async function assignResKpiGroups(
  tenantId: number,
  year: number,
  month: number,
  actorId: number | null
): Promise<ResAssignResult> {
  const out: ResAssignResult = { year, month, assigned: 0, users: 0, no_groups: 0, extra_groups: 0 };
  const period = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  if (period?.status === "closed") return out;

  const kpiNames = KPI_KEYS.map((k) => RES_ITEMS.find((i) => i.key === k)!.name);
  const [items, formulas, groups, users, confirmed] = await Promise.all([
    prisma.payrollItem.findMany({ where: { tenant_id: tenantId, name: { in: kpiNames } }, select: { id: true, name: true } }),
    prisma.payrollFormula.findMany({
      where: { tenant_id: tenantId, name: { in: Object.values(RES_KPI_FORMULA_BY_ROLE) } },
      select: { id: true, name: true, text: true }
    }),
    prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, agents: { select: { user_id: true } } },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: { in: Object.keys(RES_KPI_FORMULA_BY_ROLE) } },
      select: { id: true, role: true }
    }),
    prisma.payrollRecord.findMany({ where: { tenant_id: tenantId, year, month, status: "confirmed" }, select: { user_id: true } })
  ]);
  const itemIds = kpiNames.map((n) => items.find((i) => i.name === n)?.id);
  if (itemIds.some((id) => id == null)) return out;
  const kpiItemIds = new Set(itemIds as number[]);
  const formulaByRole = new Map(
    Object.entries(RES_KPI_FORMULA_BY_ROLE).map(([role, name]) => [role, formulas.find((f) => f.name === name)])
  );
  const frozen = new Set(confirmed.map((c) => c.user_id));

  const tz = await loadTenantTimezone(tenantId);
  const range = tenantMonthRangeUtc(year, month, tz);
  const groupsOf = (memberIds: number[]) => {
    const ids = new Set(memberIds);
    return groups.filter((g) => g.agents.some((a) => ids.has(a.user_id))).map((g) => g.id);
  };

  const touched: number[] = [];
  for (const u of users) {
    const formula = formulaByRole.get(u.role);
    if (!formula || frozen.has(u.id)) continue;
    const members = u.role === "supervisor" ? await teamAgentIds(tenantId, u.id, range) : [u.id];
    const mine = groupsOf(members);
    if (!mine.length) {
      out.no_groups++;
      continue;
    }
    if (mine.length > KPI_KEYS.length) out.extra_groups++;
    const existing = await prisma.payrollBonusAssignment.findMany({
      where: { tenant_id: tenantId, year, month, user_id: u.id },
      select: { kpi_group_id: true, target_item_id: true }
    });
    const takenGroups = new Set(existing.filter((e) => kpiItemIds.has(e.target_item_id)).map((e) => e.kpi_group_id));
    const takenItems = new Set(existing.map((e) => e.target_item_id));
    let changed = false;
    for (const [i, groupId] of mine.slice(0, KPI_KEYS.length).entries()) {
      const target = itemIds[i]!;
      if (takenGroups.has(groupId) || takenItems.has(target)) continue;
      await prisma.payrollBonusAssignment.create({
        data: {
          tenant_id: tenantId,
          year,
          month,
          user_id: u.id,
          kpi_group_id: groupId,
          trade_direction_id: 0,
          formula_id: formula.id,
          formula_text_snapshot: formula.text,
          target_item_id: target,
          created_by: actorId
        }
      });
      out.assigned++;
      changed = true;
    }
    if (changed) touched.push(u.id);
  }
  out.users = touched.length;
  if (touched.length) await markPayrollDirty(tenantId, { userIds: touched, year, month }, "bonus_assign");
  return out;
}
