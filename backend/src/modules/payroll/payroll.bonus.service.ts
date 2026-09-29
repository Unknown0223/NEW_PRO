import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { toFio } from "../staff/staff.shared.helpers";
import { markPayrollDirty } from "./payroll.dirty";
import { PayrollError } from "./payroll.route-helpers";
import { ZERO_METRICS, type KpiMetrics } from "./payroll-kpi-fact.pure";

export type BonusKpiFilter = {
  year: number;
  month: number;
  role?: string;
  trade_direction_id?: number;
  kpi_group_id?: number;
  user_ids?: number[];
  q?: string;
};

type Snap = {
  kpi?: {
    fact_total?: KpiMetrics;
    plan_total?: KpiMetrics;
    fact_by_group?: Record<string, KpiMetrics> | null;
    plan_by_group?: Record<string, KpiMetrics> | null;
  };
  formula_values?: Record<string, number>;
};

async function periodClosed(tenantId: number, year: number, month: number) {
  const p = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  return p?.status === "closed";
}

/** «Настройки бонусов и зарплат»: xodim × KPI guruh (reja/fakt) + biriktirilgan formulalar. */
export async function listBonusKpi(tenantId: number, f: BonusKpiFilter) {
  const monthUserIds = (
    await prisma.payrollRecord.findMany({ where: { tenant_id: tenantId, year: f.year, month: f.month }, select: { user_id: true } })
  ).map((r) => r.user_id);
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      NOT: { role: "admin" },
      ...(f.role ? { role: f.role } : {}),
      ...(f.user_ids?.length ? { id: { in: f.user_ids } } : {}),
      ...(f.trade_direction_id ? { trade_direction_id: f.trade_direction_id } : {}),
      OR: [{ is_active: true }, { id: { in: monthUserIds } }]
    },
    select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, code: true, role: true, is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }, { name: "asc" }],
    take: 2000
  });
  const q = f.q?.trim().toLocaleLowerCase("ru");
  const list = q ? users.filter((u) => `${toFio(u)} ${u.code ?? ""}`.toLocaleLowerCase("ru").includes(q)) : users;
  const ids = list.map((u) => u.id);
  const [records, assigns, groups, formulas, items] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: { tenant_id: tenantId, year: f.year, month: f.month, user_id: { in: ids } },
      select: { user_id: true, calc_snapshot: true, status: true }
    }),
    prisma.payrollBonusAssignment.findMany({ where: { tenant_id: tenantId, year: f.year, month: f.month, user_id: { in: ids } } }),
    prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true, ...(f.kpi_group_id ? { id: f.kpi_group_id } : {}) },
      select: { id: true, name: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }]
    }),
    prisma.payrollFormula.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } }),
    prisma.payrollItem.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } })
  ]);
  const recBy = new Map(records.map((r) => [r.user_id, r]));
  const fName = new Map(formulas.map((x) => [x.id, x.name]));
  const iName = new Map(items.map((x) => [x.id, x.name]));
  const rows = list.map((u) => {
    const rec = recBy.get(u.id);
    const snap = (rec?.calc_snapshot ?? {}) as Snap;
    const mine = assigns.filter((a) => a.user_id === u.id);
    const toAssign = (a: (typeof assigns)[number]) => ({
      id: a.id,
      kpi_group_id: a.kpi_group_id,
      trade_direction_id: a.trade_direction_id,
      formula_id: a.formula_id,
      formula_name: fName.get(a.formula_id) ?? null,
      formula_text: a.formula_text_snapshot,
      target_item_id: a.target_item_id,
      target_item_name: iName.get(a.target_item_id) ?? null,
      value: snap.formula_values?.[`bonus:${a.id}`] ?? null
    });
    return {
      user_id: u.id,
      fio: toFio(u),
      code: u.code,
      role: u.role,
      is_active: u.is_active,
      record_status: rec?.status ?? null,
      fact: snap.kpi?.fact_total ?? ZERO_METRICS,
      plan: snap.kpi?.plan_total ?? ZERO_METRICS,
      assignments_all: mine.filter((a) => a.kpi_group_id === 0).map(toAssign),
      groups: groups.map((g) => ({
        kpi_group_id: g.id,
        name: g.name,
        fact: snap.kpi?.fact_by_group?.[String(g.id)] ?? ZERO_METRICS,
        plan: snap.kpi?.plan_by_group?.[String(g.id)] ?? ZERO_METRICS,
        assignments: mine.filter((a) => a.kpi_group_id === g.id).map(toAssign)
      }))
    };
  });
  return { year: f.year, month: f.month, closed: await periodClosed(tenantId, f.year, f.month), groups, rows };
}

export type AssignInput = {
  year: number;
  month: number;
  user_ids: number[];
  kpi_group_id: number;
  trade_direction_id?: number;
  formula_id: number;
  target_item_id?: number | null;
};

export async function assignBonusFormula(tenantId: number, input: AssignInput, actorId: number | null) {
  if (await periodClosed(tenantId, input.year, input.month)) throw new PayrollError("PERIOD_CLOSED");
  const formula = await prisma.payrollFormula.findFirst({ where: { id: input.formula_id, tenant_id: tenantId } });
  if (!formula) throw new PayrollError("NOT_FOUND");
  const target = input.target_item_id ?? formula.target_item_id;
  if (!target) throw new PayrollError("BAD_ITEM");
  const item = await prisma.payrollItem.findFirst({ where: { id: target, tenant_id: tenantId }, select: { system_key: true } });
  if (!item) throw new PayrollError("BAD_ITEM");
  if (item.system_key) throw new PayrollError("SYSTEM_ITEM");
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: input.user_ids } },
    select: { id: true }
  });
  if (users.length !== new Set(input.user_ids).size) throw new PayrollError("BAD_USER");
  const confirmed = await prisma.payrollRecord.findMany({
    where: { tenant_id: tenantId, year: input.year, month: input.month, user_id: { in: input.user_ids }, status: "confirmed" },
    select: { user_id: true }
  });
  const frozen = new Set(confirmed.map((c) => c.user_id));
  const td = input.trade_direction_id ?? 0;
  let saved = 0;
  for (const u of users) {
    if (frozen.has(u.id)) continue;
    const key = {
      tenant_id: tenantId,
      year: input.year,
      month: input.month,
      user_id: u.id,
      kpi_group_id: input.kpi_group_id,
      trade_direction_id: td,
      target_item_id: target
    };
    await prisma.payrollBonusAssignment.upsert({
      where: { payroll_bonus_assignments_uq: key },
      create: { ...key, formula_id: formula.id, formula_text_snapshot: formula.text, created_by: actorId },
      update: { formula_id: formula.id, formula_text_snapshot: formula.text, created_by: actorId }
    });
    saved++;
  }
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: formula.id,
    action: "payroll.bonus.assign",
    payload: { ...input, saved, skipped_confirmed: [...frozen] }
  });
  await markPayrollDirty(tenantId, { userIds: users.map((u) => u.id), year: input.year, month: input.month }, "bonus_assign");
  return { saved, skipped_confirmed: [...frozen] };
}

export async function deleteBonusAssignment(tenantId: number, id: number, actorId: number | null) {
  const a = await prisma.payrollBonusAssignment.findFirst({ where: { id, tenant_id: tenantId } });
  if (!a) throw new PayrollError("NOT_FOUND");
  if (await periodClosed(tenantId, a.year, a.month)) throw new PayrollError("PERIOD_CLOSED");
  const rec = await prisma.payrollRecord.findUnique({
    where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: a.user_id, year: a.year, month: a.month } },
    select: { status: true }
  });
  if (rec?.status === "confirmed") throw new PayrollError("RECORD_FROZEN");
  await prisma.payrollBonusAssignment.delete({ where: { id } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.bonus.unassign",
    payload: { user_id: a.user_id, year: a.year, month: a.month, formula_id: a.formula_id }
  });
  await markPayrollDirty(tenantId, { userIds: [a.user_id], year: a.year, month: a.month }, "bonus_unassign");
}
