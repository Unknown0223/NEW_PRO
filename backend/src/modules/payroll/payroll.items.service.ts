import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ensurePayrollSystemItems } from "./payroll.settings";
import { PayrollError } from "./payroll.route-helpers";
import { markPayrollDirtyForTenant } from "./payroll.dirty";

export type PayrollItemDto = {
  id: number;
  name: string;
  code: string | null;
  type: "allowance" | "deduction";
  calc_type: "formula" | "manual" | "system";
  system_key: string | null;
  sort_order: number;
  color: string | null;
  comment: string | null;
  is_active: boolean;
  updated_at: string;
};

export type PayrollItemInput = {
  name?: string;
  code?: string | null;
  type?: "allowance" | "deduction";
  calc_type?: "formula" | "manual";
  sort_order?: number;
  color?: string | null;
  comment?: string | null;
  is_active?: boolean;
};

function toDto(r: Prisma.PayrollItemGetPayload<object>): PayrollItemDto {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    type: r.type as PayrollItemDto["type"],
    calc_type: r.calc_type as PayrollItemDto["calc_type"],
    system_key: r.system_key,
    sort_order: r.sort_order,
    color: r.color,
    comment: r.comment,
    is_active: r.is_active,
    updated_at: r.updated_at.toISOString()
  };
}

export async function listPayrollItems(
  tenantId: number,
  opts: { type?: string; activeOnly?: boolean } = {}
): Promise<PayrollItemDto[]> {
  await ensurePayrollSystemItems(tenantId);
  const rows = await prisma.payrollItem.findMany({
    where: {
      tenant_id: tenantId,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.activeOnly ? { is_active: true } : {})
    },
    orderBy: [{ type: "asc" }, { sort_order: "asc" }, { name: "asc" }]
  });
  return rows.map(toDto);
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createPayrollItem(
  tenantId: number,
  input: PayrollItemInput,
  actorUserId: number | null
): Promise<PayrollItemDto> {
  const name = input.name?.trim();
  if (!name || !input.type) throw new PayrollError("BAD_ITEM");
  try {
    const row = await prisma.payrollItem.create({
      data: {
        tenant_id: tenantId,
        name: name.slice(0, 160),
        code: input.code?.trim().slice(0, 64) || null,
        type: input.type,
        calc_type: input.calc_type ?? "manual",
        sort_order: input.sort_order ?? 100,
        color: input.color?.trim().slice(0, 16) || null,
        comment: input.comment?.trim().slice(0, 500) || null,
        is_active: input.is_active ?? true
      }
    });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.payroll,
      entityId: row.id,
      action: "payroll.item.create",
      payload: { name: row.name, type: row.type }
    });
    return toDto(row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new PayrollError("DUPLICATE_NAME");
    throw e;
  }
}

export async function updatePayrollItem(
  tenantId: number,
  id: number,
  input: PayrollItemInput,
  actorUserId: number | null
): Promise<PayrollItemDto> {
  const cur = await prisma.payrollItem.findFirst({ where: { id, tenant_id: tenantId } });
  if (!cur) throw new PayrollError("NOT_FOUND");
  const isSystem = cur.calc_type === "system";
  if (isSystem && (input.type !== undefined || input.calc_type !== undefined || input.is_active === false)) {
    throw new PayrollError("SYSTEM_ITEM");
  }
  const data: Prisma.PayrollItemUpdateInput = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new PayrollError("BAD_ITEM");
    data.name = n.slice(0, 160);
  }
  if (input.code !== undefined) data.code = input.code?.trim().slice(0, 64) || null;
  if (input.type !== undefined) data.type = input.type;
  if (input.calc_type !== undefined) data.calc_type = input.calc_type;
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.color !== undefined) data.color = input.color?.trim().slice(0, 16) || null;
  if (input.comment !== undefined) data.comment = input.comment?.trim().slice(0, 500) || null;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  try {
    const row = await prisma.payrollItem.update({ where: { id }, data });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.payroll,
      entityId: id,
      action: "payroll.item.update",
      payload: { keys: Object.keys(data) }
    });
    if (input.type !== undefined || input.is_active !== undefined) {
      await markPayrollDirtyForTenant(tenantId, "catalog");
    }
    return toDto(row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new PayrollError("DUPLICATE_NAME");
    throw e;
  }
}

export async function deletePayrollItem(tenantId: number, id: number, actorUserId: number | null): Promise<void> {
  const cur = await prisma.payrollItem.findFirst({ where: { id, tenant_id: tenantId } });
  if (!cur) throw new PayrollError("NOT_FOUND");
  if (cur.calc_type === "system") throw new PayrollError("SYSTEM_ITEM");
  const used = await prisma.payrollRecordLine.count({ where: { item_id: id, record: { tenant_id: tenantId } } });
  const usedByFormula = await prisma.payrollFormula.count({ where: { tenant_id: tenantId, target_item_id: id } });
  if (used > 0 || usedByFormula > 0) throw new PayrollError("ITEM_IN_USE", { lines: used, formulas: usedByFormula });
  await prisma.payrollItem.delete({ where: { id } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.item.delete",
    payload: { name: cur.name }
  });
}
