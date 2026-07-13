import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ListCatalogOpts } from "./product-catalog.types";
import { catalogDeactivateData, catalogRestoreData, listWhere, normCode } from "./product-catalog.shared";

export async function listProductManufacturers(tenantId: number, opts: ListCatalogOpts) {
  const where = listWhere(tenantId, opts) as Prisma.ProductManufacturerWhereInput;
  const [total, data] = await Promise.all([
    prisma.productManufacturer.count({ where }),
    prisma.productManufacturer.findMany({
      where,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
    })
  ]);
  return { total, data };
}

export async function createProductManufacturer(
  tenantId: number,
  input: { name: string; code?: string | null; sort_order?: number | null; is_active?: boolean },
  actorUserId: number | null = null
) {
  const name = input.name.trim();
  if (!name) throw new Error("VALIDATION");
  const row = await prisma.productManufacturer.create({
    data: {
      tenant_id: tenantId,
      name,
      code: normCode(input.code ?? null),
      sort_order: input.sort_order ?? null,
      is_active: input.is_active ?? true
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_manufacturer,
    entityId: row.id,
    action: "create",
    payload: { name: row.name, code: row.code }
  });
  return row;
}

export async function updateProductManufacturer(
  tenantId: number,
  id: number,
  input: Partial<{ name: string; code: string | null; sort_order: number | null; is_active: boolean }>,
  actorUserId: number | null = null
) {
  const row = await prisma.productManufacturer.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  const data: Prisma.ProductManufacturerUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) data.code = normCode(input.code);
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  const updated = await prisma.productManufacturer.update({ where: { id }, data });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_manufacturer,
    entityId: id,
    action: "update",
    payload: data as Record<string, unknown>
  });
  return updated;
}

/** Hard delete yo‘q — `is_active: false` + code void suffix. */
export async function deactivateProductManufacturer(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const row = await prisma.productManufacturer.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  if (!row.is_active) throw new Error("ALREADY_INACTIVE");
  const updated = await prisma.productManufacturer.update({
    where: { id },
    data: catalogDeactivateData(row.code, id)
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_manufacturer,
    entityId: id,
    action: "soft_delete",
    payload: { name: row.name, code: row.code, voided_code: updated.code, is_active: false }
  });
  return updated;
}

/** @deprecated Use deactivateProductManufacturer */
export async function deleteProductManufacturer(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  return deactivateProductManufacturer(tenantId, id, actorUserId);
}

export async function restoreProductManufacturer(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const row = await prisma.productManufacturer.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  if (row.is_active) throw new Error("NOT_INACTIVE");
  const updated = await prisma.productManufacturer.update({
    where: { id },
    data: catalogRestoreData(row.code, id)
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_manufacturer,
    entityId: id,
    action: "reactivate",
    payload: { name: row.name, code: updated.code, is_active: true }
  });
  return updated;
}
