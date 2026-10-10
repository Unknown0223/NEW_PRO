/**
 * ЗАРПЛАТА — формулы (CRUD).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { mapFormulaRow, mapGridRow } from "./payroll.mappers";
import type { PayrollFormulaData } from "./payroll.types";

export type FormulaListRow = PayrollFormulaData & {
  kpi_group_name: string | null;
  grid_id: number | null;
  grid_name: string | null;
  employee_count: number;
  sort_order: number;
  comment: string | null;
};

export function normCode(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s.slice(0, 32) : null;
}

export async function assertKpiGroup(tenantId: number, id: number | null | undefined): Promise<void> {
  if (id == null) return;
  const n = await prisma.kpiGroup.count({ where: { tenant_id: tenantId, id } });
  if (n === 0) throw new Error("BAD_KPI_GROUP");
}

/** Formula → grid bog‘lanishi `config.grid_id` orqali (JSON) saqlanadi. */
export function readGridId(config: unknown): number | null {
  const o = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const v = Number(o.grid_id);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}

export function withGridId(config: Record<string, unknown>, grid_id: number | null): Prisma.InputJsonValue {
  const next = { ...config };
  if (grid_id == null) delete next.grid_id;
  else next.grid_id = grid_id;
  return next as Prisma.InputJsonValue;
}

export async function listFormulas(
  tenantId: number,
  q: { is_active?: boolean; kpi_group_id?: number; role?: string; search?: string }
): Promise<FormulaListRow[]> {
  const where: Prisma.PayrollFormulaWhereInput = { tenant_id: tenantId };
  if (q.is_active !== undefined) where.is_active = q.is_active;
  if (q.kpi_group_id != null) where.kpi_group_id = q.kpi_group_id;
  if (q.role?.trim()) {
    where.OR = [{ roles: { has: q.role.trim() } }, { roles: { isEmpty: true } }];
  }
  const s = q.search?.trim();
  if (s) {
    where.AND = [
      {
        OR: [
          { name: { contains: s, mode: "insensitive" } },
          { code: { contains: s, mode: "insensitive" } },
          { comment: { contains: s, mode: "insensitive" } }
        ]
      }
    ];
  }

  const rows = await prisma.payrollFormula.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
    include: {
      kpi_group: { select: { id: true, name: true } },
      assignments: { select: { user_id: true } }
    }
  });

  if (rows.length === 0) return [];

  const gridIds = [...new Set(rows.map((r) => readGridId(r.config)).filter((x): x is number => x != null))];
  const grids = gridIds.length
    ? await prisma.payrollGrid.findMany({
        where: { tenant_id: tenantId, id: { in: gridIds } },
        include: { rows: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] } }
      })
    : [];
  const gridById = new Map(grids.map((g) => [g.id, g]));

  return rows.map((r) => {
    const gridId = readGridId(r.config);
    const gridRow = gridId != null ? gridById.get(gridId) : undefined;
    return {
      ...mapFormulaRow(r, gridRow ? mapGridRow(gridRow) : null),
      kpi_group_name: r.kpi_group?.name ?? null,
      grid_id: gridId,
      grid_name: gridRow?.name ?? null,
      employee_count: r.assignments.length,
      sort_order: r.sort_order,
      comment: r.comment
    };
  });
}

export async function getFormulaForEngine(
  tenantId: number,
  opts: { month: string; roles?: string[] }
): Promise<PayrollFormulaData[]> {
  const where: Prisma.PayrollFormulaWhereInput = { tenant_id: tenantId, is_active: true };
  const rows = await prisma.payrollFormula.findMany({
    where,
    orderBy: [{ priority: "desc" }, { id: "asc" }],
    include: { kpi_group: { select: { id: true, name: true } } }
  });

  const gridIds = [...new Set(rows.map((r) => readGridId(r.config)).filter((x): x is number => x != null))];
  const grids = gridIds.length
    ? await prisma.payrollGrid.findMany({
        where: { tenant_id: tenantId, id: { in: gridIds }, is_active: true },
        include: { rows: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] } }
      })
    : [];
  const gridById = new Map(grids.map((g) => [g.id, g]));

  return rows.map((r) => {
    const gridId = readGridId(r.config);
    const gridRow = gridId != null ? gridById.get(gridId) : undefined;
    return mapFormulaRow(r, gridRow ? mapGridRow(gridRow) : null);
  });
}

export type FormulaCreateInput = {
  name: string;
  code?: string | null;
  kind: string;
  roles?: string[];
  kpi_group_id?: number | null;
  base_amount?: number;
  config?: Record<string, unknown>;
  components?: unknown[];
  gates?: unknown[];
  grid_id?: number | null;
  priority?: number;
  is_default?: boolean;
  is_active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  sort_order?: number;
  comment?: string | null;
};

function formulaData(tenantId: number, input: FormulaCreateInput) {
  return {
    tenant_id: tenantId,
    name: input.name.trim(),
    code: normCode(input.code),
    kind: input.kind,
    roles: input.roles ?? [],
    kpi_group_id: input.kpi_group_id ?? null,
    base_amount: input.base_amount ?? 0,
    config: withGridId(input.config ?? {}, input.grid_id ?? null),
    components: (input.components ?? []) as Prisma.InputJsonValue,
    gates: (input.gates ?? []) as Prisma.InputJsonValue,
    priority: input.priority ?? 0,
    is_default: input.is_default ?? false,
    is_active: input.is_active ?? true,
    valid_from: input.valid_from ? new Date(input.valid_from) : null,
    valid_to: input.valid_to ? new Date(input.valid_to) : null,
    sort_order: input.sort_order ?? 0,
    comment: input.comment?.trim() || null
  };
}

export async function createFormula(
  tenantId: number,
  input: FormulaCreateInput,
  actorUserId: number | null
): Promise<number> {
  const code = normCode(input.code);
  if (code) {
    const dup = await prisma.payrollFormula.findFirst({ where: { tenant_id: tenantId, code } });
    if (dup) throw new Error("DUPLICATE_CODE");
  }
  await assertKpiGroup(tenantId, input.kpi_group_id);

  const row = await prisma.payrollFormula.create({ data: formulaData(tenantId, input) });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_formula",
    entityId: row.id,
    action: "create",
    payload: { name: row.name, kind: row.kind, kpi_group_id: row.kpi_group_id, roles: input.roles ?? [] }
  });
  return row.id;
}

export async function patchFormula(
  tenantId: number,
  id: number,
  input: Partial<FormulaCreateInput>,
  actorUserId: number | null
): Promise<void> {
  const existing = await prisma.payrollFormula.findFirst({ where: { tenant_id: tenantId, id } });
  if (!existing) throw new Error("NOT_FOUND");

  if (input.code !== undefined) {
    const code = normCode(input.code);
    if (code) {
      const dup = await prisma.payrollFormula.findFirst({
        where: { tenant_id: tenantId, code, NOT: { id } }
      });
      if (dup) throw new Error("DUPLICATE_CODE");
    }
  }
  if (input.kpi_group_id !== undefined) await assertKpiGroup(tenantId, input.kpi_group_id);

  const data: Prisma.PayrollFormulaUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) data.code = normCode(input.code);
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.roles !== undefined) data.roles = input.roles;
  if (input.kpi_group_id !== undefined) {
    data.kpi_group = input.kpi_group_id == null ? { disconnect: true } : { connect: { id: input.kpi_group_id } };
  }
  if (input.base_amount !== undefined) data.base_amount = input.base_amount;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.is_default !== undefined) data.is_default = input.is_default;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.comment !== undefined) data.comment = input.comment?.trim() || null;
  if (input.valid_from !== undefined) data.valid_from = input.valid_from ? new Date(input.valid_from) : null;
  if (input.valid_to !== undefined) data.valid_to = input.valid_to ? new Date(input.valid_to) : null;
  if (input.components !== undefined) data.components = input.components as Prisma.InputJsonValue;
  if (input.gates !== undefined) data.gates = input.gates as Prisma.InputJsonValue;

  const existingConfig =
    existing.config && typeof existing.config === "object" && !Array.isArray(existing.config)
      ? { ...(existing.config as Record<string, unknown>) }
      : {};
  const mergedConfig = input.config !== undefined ? { ...existingConfig, ...input.config } : existingConfig;
  const gridId = input.grid_id !== undefined ? input.grid_id : readGridId(existing.config);
  data.config = withGridId(mergedConfig, gridId);

  await prisma.payrollFormula.update({ where: { id }, data });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_formula",
    entityId: id,
    action: "update",
    payload: { changed: Object.keys(input) }
  });
}
