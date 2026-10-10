/**
 * ЗАРПЛАТА — сетки (тарифные сетки) и индивидуальная привязка сотрудников.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { assertKpiGroup, normCode, withGridId } from "./payroll.formulas.crud";
import { mapGridRow } from "./payroll.mappers";
import type { PayrollGridData } from "./payroll.types";

export type GridListRow = PayrollGridData & {
  kpi_group_name: string | null;
  is_active: boolean;
  sort_order: number;
  comment: string | null;
};

export async function listGrids(
  tenantId: number,
  q: { is_active?: boolean; kpi_group_id?: number; search?: string }
): Promise<GridListRow[]> {
  const where: Prisma.PayrollGridWhereInput = { tenant_id: tenantId };
  if (q.is_active !== undefined) where.is_active = q.is_active;
  if (q.kpi_group_id != null) where.kpi_group_id = q.kpi_group_id;
  const s = q.search?.trim();
  if (s) {
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } }
    ];
  }
  const rows = await prisma.payrollGrid.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
    include: {
      kpi_group: { select: { id: true, name: true } },
      rows: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] }
    }
  });
  return rows.map((r) => ({
    ...mapGridRow(r),
    kpi_group_name: r.kpi_group?.name ?? null,
    is_active: r.is_active,
    sort_order: r.sort_order,
    comment: r.comment
  }));
}

export type GridCreateInput = {
  name: string;
  code?: string | null;
  kpi_group_id?: number | null;
  metric?: string;
  mode?: string;
  is_active?: boolean;
  sort_order?: number;
  comment?: string | null;
  steps?: Array<Record<string, unknown>>;
};

export async function createGrid(
  tenantId: number,
  input: GridCreateInput,
  actorUserId: number | null
): Promise<number> {
  const code = normCode(input.code);
  if (code) {
    const dup = await prisma.payrollGrid.findFirst({ where: { tenant_id: tenantId, code } });
    if (dup) throw new Error("DUPLICATE_CODE");
  }
  await assertKpiGroup(tenantId, input.kpi_group_id);

  const row = await prisma.$transaction(async (tx) => {
    const g = await tx.payrollGrid.create({
      data: {
        tenant_id: tenantId,
        name: input.name.trim(),
        code,
        kpi_group_id: input.kpi_group_id ?? null,
        metric: input.metric ?? "kpi_percent",
        mode: input.mode ?? "coefficient",
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
        comment: input.comment?.trim() || null
      }
    });
    const steps = input.steps ?? [];
    if (steps.length > 0) {
      await tx.payrollGridRow.createMany({
        data: steps.map((s, i) => ({
          tenant_id: tenantId,
          grid_id: g.id,
          month: typeof s.month === "string" ? s.month : null,
          from_value: s.from_value == null ? null : Number(s.from_value),
          to_value: s.to_value == null ? null : Number(s.to_value),
          coefficient: Number(s.coefficient ?? 1),
          amount: Number(s.amount ?? 0),
          sort_order: Number(s.sort_order ?? i)
        }))
      });
    }
    return g;
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_grid",
    entityId: row.id,
    action: "create",
    payload: { name: row.name, metric: row.metric, mode: row.mode, steps: (input.steps ?? []).length }
  });
  return row.id;
}

/** Сеткani yangilash: qatorlar to‘liq almashtiriladi (replace). */
export async function patchGrid(
  tenantId: number,
  id: number,
  input: Partial<GridCreateInput>,
  actorUserId: number | null
): Promise<void> {
  const existing = await prisma.payrollGrid.findFirst({ where: { tenant_id: tenantId, id } });
  if (!existing) throw new Error("NOT_FOUND");
  if (input.kpi_group_id !== undefined) await assertKpiGroup(tenantId, input.kpi_group_id);

  await prisma.$transaction(async (tx) => {
    const data: Prisma.PayrollGridUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.code !== undefined) data.code = normCode(input.code);
    if (input.metric !== undefined) data.metric = input.metric;
    if (input.mode !== undefined) data.mode = input.mode;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;
    if (input.comment !== undefined) data.comment = input.comment?.trim() || null;
    if (input.kpi_group_id !== undefined) {
      data.kpi_group = input.kpi_group_id == null ? { disconnect: true } : { connect: { id: input.kpi_group_id } };
    }
    await tx.payrollGrid.update({ where: { id }, data });

    if (input.steps !== undefined) {
      await tx.payrollGridRow.deleteMany({ where: { grid_id: id, tenant_id: tenantId } });
      if (input.steps.length > 0) {
        await tx.payrollGridRow.createMany({
          data: input.steps.map((s, i) => ({
            tenant_id: tenantId,
            grid_id: id,
            month: typeof s.month === "string" ? s.month : null,
            from_value: s.from_value == null ? null : Number(s.from_value),
            to_value: s.to_value == null ? null : Number(s.to_value),
            coefficient: Number(s.coefficient ?? 1),
            amount: Number(s.amount ?? 0),
            sort_order: Number(s.sort_order ?? i)
          }))
        });
      }
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_grid",
    entityId: id,
    action: "update",
    payload: { changed: Object.keys(input) }
  });
}

export type AssignmentRow = {
  user_id: number;
  fio: string;
  role: string;
  kpi_group_ids: number[];
  formula_id: number | null;
  formula_name: string | null;
  base_amount: number | null;
  comment: string | null;
};

export async function listAssignments(
  tenantId: number,
  q: { role?: string; search?: string }
): Promise<AssignmentRow[]> {
  const where: Prisma.UserWhereInput = { tenant_id: tenantId, is_active: true };
  if (q.role?.trim()) where.role = q.role.trim();
  const s = q.search?.trim();
  if (s) {
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { login: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } }
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, role: true, kpi_group_links: { select: { kpi_group_id: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  if (users.length === 0) return [];

  const assignments = await prisma.payrollAssignment.findMany({
    where: { tenant_id: tenantId, user_id: { in: users.map((u) => u.id) } },
    include: { formula: { select: { id: true, name: true } } }
  });
  const byUser = new Map(assignments.map((a) => [a.user_id, a]));

  return users.map((u) => {
    const a = byUser.get(u.id);
    return {
      user_id: u.id,
      fio: u.name,
      role: u.role,
      kpi_group_ids: u.kpi_group_links.map((l) => l.kpi_group_id),
      formula_id: a?.formula_id ?? null,
      formula_name: a?.formula?.name ?? null,
      base_amount: a?.base_amount == null ? null : Number(a.base_amount),
      comment: a?.comment ?? null
    };
  });
}

export async function saveAssignments(
  tenantId: number,
  items: Array<{
    user_id: number;
    formula_id?: number | null;
    base_amount?: number | null;
    comment?: string | null;
  }>,
  actorUserId: number | null
): Promise<number> {
  if (items.length === 0) return 0;
  const userIds = items.map((i) => i.user_id);
  const users = await prisma.user.count({ where: { tenant_id: tenantId, id: { in: userIds } } });
  if (users !== new Set(userIds).size) throw new Error("BAD_USER_IDS");

  const formulaIds = items.map((i) => i.formula_id).filter((x): x is number => typeof x === "number");
  if (formulaIds.length > 0) {
    const n = await prisma.payrollFormula.count({
      where: { tenant_id: tenantId, id: { in: [...new Set(formulaIds)] } }
    });
    if (n !== new Set(formulaIds).size) throw new Error("BAD_FORMULA_IDS");
  }

  await prisma.$transaction(
    items.map((i) =>
      prisma.payrollAssignment.upsert({
        where: { tenant_id_user_id: { tenant_id: tenantId, user_id: i.user_id } },
        create: {
          tenant_id: tenantId,
          user_id: i.user_id,
          formula_id: i.formula_id ?? null,
          base_amount: i.base_amount ?? null,
          comment: i.comment?.trim() || null,
          updated_by: actorUserId
        },
        update: {
          formula_id: i.formula_id === undefined ? undefined : i.formula_id,
          base_amount: i.base_amount === undefined ? undefined : i.base_amount,
          comment: i.comment === undefined ? undefined : i.comment?.trim() || null,
          updated_by: actorUserId
        }
      })
    )
  );

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_assignment",
    entityId: tenantId,
    action: "update",
    payload: { count: items.length }
  });
  return items.length;
}
