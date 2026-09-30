import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { toFio } from "../staff/staff.shared.helpers";
import { PayrollError } from "./payroll.route-helpers";
import { markPayrollDirty, markPayrollDirtyForTenant } from "./payroll.dirty";
import { mergeItemAmounts, parseItemAmounts } from "./payroll.item-amounts.pure";

export type RoleConfigDto = {
  role: string;
  base_amount: number;
  currency: string;
  allowance_item_ids: number[];
  deduction_item_ids: number[];
  comment: string | null;
  employees: number;
};

export type EmployeeConfigDto = {
  user_id: number;
  fio: string;
  code: string | null;
  role: string;
  branch: string | null;
  is_active: boolean;
  role_base_amount: number;
  base_amount: number | null;
  effective_base_amount: number;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  comment: string | null;
  item_amounts: Record<string, number>;
};

const EXCLUDED_ROLES = ["admin"];

export async function listRoleConfigs(tenantId: number): Promise<RoleConfigDto[]> {
  const [roleCounts, configs] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { tenant_id: tenantId, is_active: true, role: { notIn: EXCLUDED_ROLES } },
      _count: { _all: true }
    }),
    prisma.payrollRoleConfig.findMany({ where: { tenant_id: tenantId } })
  ]);
  const byRole = new Map(configs.map((c) => [c.role, c]));
  const roles = [...new Set([...roleCounts.map((r) => r.role), ...configs.map((c) => c.role)])];
  const counts = new Map(roleCounts.map((r) => [r.role, r._count._all]));
  return roles
    .filter((r) => r && !EXCLUDED_ROLES.includes(r))
    .sort((a, b) => a.localeCompare(b))
    .map((role) => {
      const c = byRole.get(role);
      return {
        role,
        base_amount: c ? Number(c.base_amount) : 0,
        currency: c?.currency ?? "UZS",
        allowance_item_ids: c?.allowance_item_ids ?? [],
        deduction_item_ids: c?.deduction_item_ids ?? [],
        comment: c?.comment ?? null,
        employees: counts.get(role) ?? 0
      };
    });
}

export async function upsertRoleConfig(
  tenantId: number,
  role: string,
  input: {
    base_amount?: number;
    currency?: string;
    allowance_item_ids?: number[];
    deduction_item_ids?: number[];
    comment?: string | null;
  },
  actorUserId: number | null
): Promise<void> {
  const r = role.trim();
  if (!r || EXCLUDED_ROLES.includes(r)) throw new PayrollError("BAD_ROLE");
  if (input.base_amount !== undefined && (!Number.isFinite(input.base_amount) || input.base_amount < 0)) {
    throw new PayrollError("BAD_AMOUNT");
  }
  const data = {
    ...(input.base_amount !== undefined ? { base_amount: new Prisma.Decimal(input.base_amount) } : {}),
    ...(input.currency !== undefined ? { currency: input.currency.trim().toUpperCase().slice(0, 8) || "UZS" } : {}),
    ...(input.allowance_item_ids !== undefined ? { allowance_item_ids: [...new Set(input.allowance_item_ids)] } : {}),
    ...(input.deduction_item_ids !== undefined ? { deduction_item_ids: [...new Set(input.deduction_item_ids)] } : {}),
    ...(input.comment !== undefined ? { comment: input.comment?.trim().slice(0, 500) || null } : {})
  };
  await prisma.payrollRoleConfig.upsert({
    where: { tenant_id_role: { tenant_id: tenantId, role: r } },
    create: { tenant_id: tenantId, role: r, ...data },
    update: data
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.payroll,
    entityId: `role:${r}`,
    action: "payroll.role_config.upsert",
    payload: { ...input }
  });
  const users = await prisma.user.findMany({ where: { tenant_id: tenantId, role: r }, select: { id: true } });
  await markPayrollDirty(tenantId, { userIds: users.map((u) => u.id) }, "role_config");
}

export async function listEmployeeConfigs(
  tenantId: number,
  filters: { role?: string; q?: string; includeInactive?: boolean }
): Promise<EmployeeConfigDto[]> {
  const where: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    role: filters.role ? filters.role : { notIn: EXCLUDED_ROLES },
    ...(filters.includeInactive ? {} : { OR: [{ is_active: true }, { dismissed_at: { not: null } }] })
  };
  const q = filters.q?.trim();
  if (q) {
    where.AND = [
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { login: { contains: q, mode: "insensitive" } }
        ]
      }
    ];
  }
  const [users, roleCfgs, empCfgs, desks] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        code: true,
        role: true,
        branch: true,
        is_active: true
      },
      orderBy: [{ role: "asc" }, { last_name: "asc" }, { name: "asc" }],
      take: 2000
    }),
    prisma.payrollRoleConfig.findMany({ where: { tenant_id: tenantId } }),
    prisma.payrollEmployeeConfig.findMany({ where: { tenant_id: tenantId } }),
    prisma.cashDesk.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } })
  ]);
  const roleBase = new Map(roleCfgs.map((c) => [c.role, Number(c.base_amount)]));
  const emp = new Map(empCfgs.map((c) => [c.user_id, c]));
  const deskName = new Map(desks.map((d) => [d.id, d.name]));
  return users.map((u) => {
    const c = emp.get(u.id);
    const rb = roleBase.get(u.role) ?? 0;
    const own = c?.base_amount != null ? Number(c.base_amount) : null;
    return {
      user_id: u.id,
      fio: toFio(u),
      code: u.code,
      role: u.role,
      branch: u.branch,
      is_active: u.is_active,
      role_base_amount: rb,
      base_amount: own,
      effective_base_amount: own ?? rb,
      cash_desk_id: c?.cash_desk_id ?? null,
      cash_desk_name: c?.cash_desk_id ? deskName.get(c.cash_desk_id) ?? null : null,
      comment: c?.comment ?? null,
      item_amounts: parseItemAmounts(c?.item_amounts)
    };
  });
}

export type EmployeeConfigInput = {
  base_amount?: number | null;
  cash_desk_id?: number | null;
  comment?: string | null;
  item_amounts?: Record<string, number | null>;
};

async function assertAllowanceItems(tenantId: number, ids: string[]) {
  const nums = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (!nums.length) return;
  const found = await prisma.payrollItem.count({
    where: { tenant_id: tenantId, id: { in: nums }, type: "allowance", system_key: null }
  });
  if (found !== nums.length) throw new PayrollError("BAD_ITEM");
}

async function assertDesk(tenantId: number, id: number | null | undefined) {
  if (id == null) return;
  const d = await prisma.cashDesk.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
  if (!d) throw new PayrollError("BAD_CASH_DESK");
}

export async function upsertEmployeeConfig(
  tenantId: number,
  userId: number,
  input: EmployeeConfigInput,
  actorUserId: number | null
): Promise<void> {
  const u = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId }, select: { id: true } });
  if (!u) throw new PayrollError("BAD_USER");
  if (input.base_amount != null && (!Number.isFinite(input.base_amount) || input.base_amount < 0)) {
    throw new PayrollError("BAD_AMOUNT");
  }
  await assertDesk(tenantId, input.cash_desk_id);
  let itemAmounts: Record<string, number> | undefined;
  if (input.item_amounts !== undefined) {
    const setIds = Object.entries(input.item_amounts)
      .filter(([, v]) => v != null)
      .map(([k]) => k);
    await assertAllowanceItems(tenantId, setIds);
    const prev = await prisma.payrollEmployeeConfig.findUnique({
      where: { tenant_id_user_id: { tenant_id: tenantId, user_id: userId } },
      select: { item_amounts: true }
    });
    itemAmounts = mergeItemAmounts(prev?.item_amounts, input.item_amounts);
  }
  const data = {
    ...(input.base_amount !== undefined
      ? { base_amount: input.base_amount == null ? null : new Prisma.Decimal(input.base_amount) }
      : {}),
    ...(input.cash_desk_id !== undefined ? { cash_desk_id: input.cash_desk_id } : {}),
    ...(input.comment !== undefined ? { comment: input.comment?.trim().slice(0, 500) || null } : {}),
    ...(itemAmounts !== undefined ? { item_amounts: itemAmounts } : {})
  };
  await prisma.payrollEmployeeConfig.upsert({
    where: { tenant_id_user_id: { tenant_id: tenantId, user_id: userId } },
    create: { tenant_id: tenantId, user_id: userId, ...data },
    update: data
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.payroll,
    entityId: `user:${userId}`,
    action: "payroll.employee_config.upsert",
    payload: { ...input }
  });
  await markPayrollDirty(tenantId, { userIds: [userId] }, "employee_config");
}

export type EmployeeConfigImportRow = {
  code: string;
  base_amount?: number | null;
  cash_desk?: string | null;
  item_amounts?: Record<string, number>;
};
export type EmployeeConfigImportPreview = {
  row: number;
  code: string;
  user_id: number | null;
  fio: string | null;
  base_amount: number | null;
  cash_desk_id: number | null;
  status: "ok" | "not_found" | "bad_cash_desk" | "bad_amount";
};

export async function importEmployeeConfigs(
  tenantId: number,
  rows: EmployeeConfigImportRow[],
  apply: boolean,
  actorUserId: number | null
): Promise<{ preview: EmployeeConfigImportPreview[]; applied: number }> {
  const desks = await prisma.cashDesk.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true, code: true } });
  const deskByKey = new Map<string, number>();
  for (const d of desks) {
    deskByKey.set(d.name.trim().toLowerCase(), d.id);
    if (d.code) deskByKey.set(d.code.trim().toLowerCase(), d.id);
    deskByKey.set(String(d.id), d.id);
  }
  const codes = [...new Set(rows.map((r) => r.code.trim()).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, OR: codes.map((c) => ({ code: { equals: c, mode: "insensitive" as const } })) },
    select: { id: true, code: true, name: true, first_name: true, last_name: true, middle_name: true, is_active: true }
  });
  const allowanceIds = new Set(
    (
      await prisma.payrollItem.findMany({
        where: { tenant_id: tenantId, type: "allowance", system_key: null },
        select: { id: true }
      })
    ).map((i) => i.id)
  );
  const userByCode = new Map<string, (typeof users)[number]>();
  for (const u of users.sort((a, b) => Number(a.is_active) - Number(b.is_active))) {
    if (u.code) userByCode.set(u.code.trim().toLowerCase(), u);
  }
  const preview: EmployeeConfigImportPreview[] = rows.map((r, i) => {
    const u = userByCode.get(r.code.trim().toLowerCase());
    const deskKey = r.cash_desk?.trim().toLowerCase();
    const deskId = deskKey ? deskByKey.get(deskKey) ?? null : null;
    const amount = r.base_amount ?? null;
    const parts = Object.entries(r.item_amounts ?? {});
    let status: EmployeeConfigImportPreview["status"] = "ok";
    if (!u) status = "not_found";
    else if (deskKey && deskId == null) status = "bad_cash_desk";
    else if (amount != null && (!Number.isFinite(amount) || amount < 0)) status = "bad_amount";
    else if (parts.some(([k, v]) => !allowanceIds.has(Number(k)) || !Number.isFinite(v) || v < 0)) status = "bad_amount";
    return {
      row: i + 1,
      code: r.code,
      user_id: u?.id ?? null,
      fio: u ? toFio(u) : null,
      base_amount: amount,
      cash_desk_id: deskId,
      status
    };
  });
  let applied = 0;
  if (apply) {
    for (const [i, p] of preview.entries()) {
      if (p.status !== "ok" || p.user_id == null) continue;
      const patch = rows[i]?.item_amounts;
      let itemAmounts: Record<string, number> | undefined;
      if (patch && Object.keys(patch).length) {
        const prev = await prisma.payrollEmployeeConfig.findUnique({
          where: { tenant_id_user_id: { tenant_id: tenantId, user_id: p.user_id } },
          select: { item_amounts: true }
        });
        itemAmounts = mergeItemAmounts(prev?.item_amounts, patch);
      }
      const data = {
        ...(p.base_amount != null ? { base_amount: new Prisma.Decimal(p.base_amount) } : {}),
        ...(p.cash_desk_id != null ? { cash_desk_id: p.cash_desk_id } : {}),
        ...(itemAmounts ? { item_amounts: itemAmounts } : {})
      };
      await prisma.payrollEmployeeConfig.upsert({
        where: { tenant_id_user_id: { tenant_id: tenantId, user_id: p.user_id } },
        create: { tenant_id: tenantId, user_id: p.user_id, ...data },
        update: data
      });
      applied += 1;
    }
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.payroll,
      entityId: "employee_configs",
      action: "payroll.employee_config.import",
      payload: { rows: rows.length, applied }
    });
    await markPayrollDirtyForTenant(tenantId, "employee_config");
  }
  return { preview, applied };
}
