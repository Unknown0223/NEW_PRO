import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ListCatalogOpts } from "./product-catalog.types";
import { catalogDeactivateData, catalogRestoreData, listWhere, normCode } from "./product-catalog.shared";

export async function listProductCatalogGroups(tenantId: number, opts: ListCatalogOpts) {
  const where = listWhere(tenantId, opts);
  const [total, rows] = await Promise.all([
    prisma.productCatalogGroup.count({ where }),
    prisma.productCatalogGroup.findMany({
      where,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
    })
  ]);
  return { total, data: rows };
}

export async function createProductCatalogGroup(
  tenantId: number,
  input: { name: string; code?: string | null; sort_order?: number | null; is_active?: boolean },
  actorUserId: number | null = null
) {
  const name = input.name.trim();
  if (!name) throw new Error("VALIDATION");
  const row = await prisma.productCatalogGroup.create({
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
    entityType: AuditEntityType.product_catalog_group,
    entityId: row.id,
    action: "create",
    payload: { name: row.name, code: row.code }
  });
  return row;
}

export async function updateProductCatalogGroup(
  tenantId: number,
  id: number,
  input: Partial<{ name: string; code: string | null; sort_order: number | null; is_active: boolean }>,
  actorUserId: number | null = null
) {
  const row = await prisma.productCatalogGroup.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  const data: Prisma.ProductCatalogGroupUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) data.code = normCode(input.code);
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  const updated = await prisma.productCatalogGroup.update({ where: { id }, data });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_catalog_group,
    entityId: id,
    action: "update",
    payload: data as Record<string, unknown>
  });
  return updated;
}

/** Hard delete yo‘q — `is_active: false` + code void suffix. */
export async function deactivateProductCatalogGroup(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const row = await prisma.productCatalogGroup.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  if (!row.is_active) throw new Error("ALREADY_INACTIVE");
  const updated = await prisma.productCatalogGroup.update({
    where: { id },
    data: catalogDeactivateData(row.code, id)
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_catalog_group,
    entityId: id,
    action: "soft_delete",
    payload: { name: row.name, code: row.code, voided_code: updated.code, is_active: false }
  });
  return updated;
}

/** @deprecated Use deactivateProductCatalogGroup */
export async function deleteProductCatalogGroup(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  return deactivateProductCatalogGroup(tenantId, id, actorUserId);
}

export async function restoreProductCatalogGroup(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const row = await prisma.productCatalogGroup.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  if (row.is_active) throw new Error("NOT_INACTIVE");
  const updated = await prisma.productCatalogGroup.update({
    where: { id },
    data: catalogRestoreData(row.code, id)
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_catalog_group,
    entityId: id,
    action: "reactivate",
    payload: { name: row.name, code: updated.code, is_active: true }
  });
  return updated;
}
