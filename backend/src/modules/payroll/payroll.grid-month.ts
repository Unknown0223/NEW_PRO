import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { markPayrollDirtyForTenant } from "./payroll.dirty";
import { parseItemAmounts, mergeItemAmounts, mergeKpiAmounts, parseKpiAmounts } from "./payroll.item-amounts.pure";
import { effectiveGrid, ymKey, type GridSnap } from "./payroll.grid-month.pure";
import { PayrollError } from "./payroll.route-helpers";
import type { EmployeeConfigDto, RoleConfigDto } from "./payroll.configs.service";

async function closed(tenantId: number, year: number, month: number) {
  const p = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  return p?.status === "closed";
}

export async function snaps(tenantId: number): Promise<GridSnap[]> {
  const rows = await prisma.payrollGridMonth.findMany({ where: { tenant_id: tenantId } });
  return rows.map((r) => ({
    ym: ymKey(r.year, r.month),
    scope: r.scope === "user" ? "user" : "role",
    role: r.role,
    user_id: r.user_id,
    base_amount: r.base_amount == null ? null : Number(r.base_amount),
    item_amounts: parseItemAmounts(r.item_amounts),
    raw: r.item_amounts
  }));
}

export async function writeSnap(
  tenantId: number,
  year: number,
  month: number,
  scope: "role" | "user",
  role: string,
  userId: number,
  base: number | null,
  amounts: object
) {
  await prisma.payrollGridMonth.upsert({
    where: {
      tenant_id_year_month_scope_role_user_id: { tenant_id: tenantId, year, month, scope, role, user_id: userId }
    },
    create: {
      tenant_id: tenantId,
      year,
      month,
      scope,
      role,
      user_id: userId,
      base_amount: base == null ? null : new Prisma.Decimal(base),
      item_amounts: amounts
    },
    update: {
      base_amount: base == null ? null : new Prisma.Decimal(base),
      item_amounts: amounts
    }
  });
}

export async function overlayRoleGrids(tenantId: number, year: number, month: number, roles: RoleConfigDto[]): Promise<RoleConfigDto[]> {
  const rows = await snaps(tenantId);
  const ym = ymKey(year, month);
  return roles.map((role) => {
    const hit = effectiveGrid(rows, ym, role.role, 0);
    if (!hit) return role;
    return { ...role, base_amount: hit.base_amount ?? role.base_amount, item_amounts: hit.item_amounts };
  });
}

export async function overlayEmployeeGrids(tenantId: number, year: number, month: number, rowsIn: EmployeeConfigDto[]): Promise<EmployeeConfigDto[]> {
  const rows = await snaps(tenantId);
  const ym = ymKey(year, month);
  return rowsIn.map((emp) => {
    const roleOnly = effectiveGrid(rows, ym, emp.role, 0);
    const userOnly = rows.filter((r) => r.scope === "user" && r.user_id === emp.user_id && r.ym <= ym).sort((a, b) => b.ym - a.ym)[0];
    if (!roleOnly && !userOnly) return emp;
    return {
      ...emp,
      base_amount: userOnly ? userOnly.base_amount : emp.base_amount,
      effective_base_amount: userOnly?.base_amount ?? roleOnly?.base_amount ?? emp.effective_base_amount,
      item_amounts: userOnly?.item_amounts ?? emp.item_amounts,
      role_item_amounts: roleOnly?.item_amounts ?? emp.role_item_amounts
    };
  });
}

export async function saveRoleGrid(
  tenantId: number,
  role: string,
  year: number,
  month: number,
  patch: { base_amount?: number; item_amounts?: Record<string, number | null> }
) {
  if (await closed(tenantId, year, month)) throw new PayrollError("PERIOD_CLOSED");
  const rows = await snaps(tenantId);
  const live = await prisma.payrollRoleConfig.findUnique({ where: { tenant_id_role: { tenant_id: tenantId, role } } });
  const prev = effectiveGrid(rows, ymKey(year, month), role, 0);
  const amounts = patch.item_amounts
    ? mergeItemAmounts(prev?.item_amounts ?? live?.item_amounts, patch.item_amounts)
    : (prev?.item_amounts ?? parseItemAmounts(live?.item_amounts));
  const base = patch.base_amount ?? prev?.base_amount ?? (live ? Number(live.base_amount) : 0);
  await writeSnap(tenantId, year, month, "role", role, 0, base, amounts);
  void markPayrollDirtyForTenant(tenantId, "grid");
}

export async function saveUserGrid(
  tenantId: number,
  userId: number,
  role: string,
  year: number,
  month: number,
  patch: { base_amount?: number | null; item_amounts?: Record<string, number | null> }
) {
  if (await closed(tenantId, year, month)) throw new PayrollError("PERIOD_CLOSED");
  const rows = await snaps(tenantId);
  const live = await prisma.payrollEmployeeConfig.findUnique({ where: { tenant_id_user_id: { tenant_id: tenantId, user_id: userId } } });
  const prev = rows.filter((r) => r.scope === "user" && r.user_id === userId && r.ym <= ymKey(year, month)).sort((a, b) => b.ym - a.ym)[0];
  const amounts = patch.item_amounts
    ? mergeItemAmounts(prev?.item_amounts ?? live?.item_amounts, patch.item_amounts)
    : (prev?.item_amounts ?? parseItemAmounts(live?.item_amounts));
  const base = patch.base_amount !== undefined ? patch.base_amount : (prev?.base_amount ?? (live?.base_amount == null ? null : Number(live.base_amount)));
  const kept = parseKpiAmounts(prev?.raw ?? live?.item_amounts);
  const full: Record<string, unknown> = { ...amounts };
  for (const [id, n] of Object.entries(kept)) full[`kpi:${id}`] = n;
  await writeSnap(tenantId, year, month, "user", role, userId, base, full);
  void markPayrollDirtyForTenant(tenantId, "grid");
}

/** Eski oydagi setka (yoki joriy sozlama) yangi oyga alohida nusxa bo'lib yoziladi. */
export async function copyGrids(tenantId: number, from: { year: number; month: number }, to: { year: number; month: number }) {
  if (ymKey(from.year, from.month) === ymKey(to.year, to.month)) throw new PayrollError("BAD_MONTH");
  if (await closed(tenantId, to.year, to.month)) throw new PayrollError("PERIOD_CLOSED");
  const [rows, roles, users] = await Promise.all([
    snaps(tenantId),
    prisma.payrollRoleConfig.findMany({ where: { tenant_id: tenantId } }),
    prisma.payrollEmployeeConfig.findMany({ where: { tenant_id: tenantId } })
  ]);
  const userRoles = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: users.map((u) => u.user_id) } },
    select: { id: true, role: true }
  });
  const roleOf = new Map(userRoles.map((u) => [u.id, u.role]));
  let copied = 0;
  for (const role of roles) {
    const hit = effectiveGrid(rows, ymKey(from.year, from.month), role.role, 0);
    const amounts = hit?.item_amounts ?? parseItemAmounts(role.item_amounts);
    const base = hit?.base_amount ?? Number(role.base_amount);
    if (!rows.some((r) => r.scope === "role" && r.role === role.role && r.ym === ymKey(from.year, from.month))) {
      await writeSnap(tenantId, from.year, from.month, "role", role.role, 0, base, amounts);
    }
    await writeSnap(tenantId, to.year, to.month, "role", role.role, 0, base, amounts);
    copied++;
  }
  for (const emp of users) {
    const role = roleOf.get(emp.user_id) ?? "";
    const own = rows.filter((r) => r.scope === "user" && r.user_id === emp.user_id && r.ym <= ymKey(from.year, from.month)).sort((a, b) => b.ym - a.ym)[0];
    const liveAmounts = parseItemAmounts(emp.item_amounts);
    const liveKpi = parseKpiAmounts(emp.item_amounts);
    if (!own && !Object.keys(liveAmounts).length && !Object.keys(liveKpi).length && emp.base_amount == null) continue;
    const amounts = { ...(own?.raw && typeof own.raw === "object" ? (own.raw as Record<string, unknown>) : {}), ...((own?.item_amounts ?? liveAmounts) as Record<string, unknown>) };
    if (!own) {
      for (const [id, n] of Object.entries(liveKpi)) amounts[`kpi:${id}`] = n;
    }
    const base = own?.base_amount ?? (emp.base_amount == null ? null : Number(emp.base_amount));
    if (!rows.some((r) => r.scope === "user" && r.user_id === emp.user_id && r.ym === ymKey(from.year, from.month))) {
      await writeSnap(tenantId, from.year, from.month, "user", role, emp.user_id, base, amounts);
    }
    await writeSnap(tenantId, to.year, to.month, "user", role, emp.user_id, base, amounts);
    copied++;
  }
  void markPayrollDirtyForTenant(tenantId, "grid-copy");
  return { copied };
}

export async function gridForCalc(
  tenantId: number,
  userId: number,
  role: string,
  year: number,
  month: number,
  rows?: GridSnap[]
): Promise<GridSnap | null> {
  const all = rows ?? (await snaps(tenantId));
  return effectiveGrid(all.filter((r) => r.role === role || r.user_id === userId), ymKey(year, month), role, userId);
}
