import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ProductCategoryListRow } from "./reference.category.types";
import {
  assertParentAllowed,
  depthFromRoot,
  maxDepthBelow,
  normalizeCategoryCode
} from "./reference.category.helpers";

export async function createProductCategoryRow(
  tenantId: number,
  input: {
    name: string;
    parent_id?: number | null;
    code?: string | null;
    sort_order?: number | null;
    default_unit?: string | null;
    is_active?: boolean;
    comment?: string | null;
  },
  actorUserId: number | null = null
): Promise<ProductCategoryListRow> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error("EMPTY_NAME");
  }
  const parentId = input.parent_id ?? null;
  await assertParentAllowed(tenantId, parentId);
  if (parentId != null) {
    const p = await prisma.productCategory.findFirst({
      where: { id: parentId, tenant_id: tenantId }
    });
    if (!p) {
      throw new Error("BAD_PARENT");
    }
  }
  let code: string | null = null;
  try {
    code = normalizeCategoryCode(input.code ?? null);
  } catch {
    throw new Error("BAD_CODE");
  }
  const row = await prisma.productCategory.create({
    data: {
      tenant_id: tenantId,
      name: trimmed,
      parent_id: parentId,
      code,
      sort_order: input.sort_order ?? null,
      default_unit: input.default_unit?.trim() || null,
      is_active: input.is_active ?? true,
      comment: input.comment?.trim() || null
    },
    select: {
      id: true,
      name: true,
      parent_id: true,
      code: true,
      sort_order: true,
      default_unit: true,
      is_active: true,
      comment: true,
      created_at: true
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_category,
    entityId: row.id,
    action: "create",
    payload: { name: row.name, parent_id: row.parent_id }
  });
  return row;
}

export async function updateProductCategoryRow(
  tenantId: number,
  id: number,
  patch: {
    name?: string;
    parent_id?: number | null;
    code?: string | null;
    sort_order?: number | null;
    default_unit?: string | null;
    is_active?: boolean;
    comment?: string | null;
  },
  actorUserId: number | null = null
): Promise<ProductCategoryListRow> {
  const existing = await prisma.productCategory.findFirst({ where: { id, tenant_id: tenantId } });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  const data: {
    name?: string;
    parent_id?: number | null;
    code?: string | null;
    sort_order?: number | null;
    default_unit?: string | null;
    is_active?: boolean;
    comment?: string | null;
  } = {};
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) {
      throw new Error("EMPTY_NAME");
    }
    data.name = t;
  }
  if (patch.code !== undefined) {
    try {
      data.code = normalizeCategoryCode(patch.code);
    } catch {
      throw new Error("BAD_CODE");
    }
  }
  if (patch.sort_order !== undefined) {
    data.sort_order = patch.sort_order;
  }
  if (patch.default_unit !== undefined) {
    data.default_unit = patch.default_unit?.trim() || null;
  }
  if (patch.is_active !== undefined) {
    data.is_active = patch.is_active;
  }
  if (patch.comment !== undefined) {
    data.comment = patch.comment?.trim() || null;
  }
  if (patch.parent_id !== undefined) {
    if (patch.parent_id === null) {
      data.parent_id = null;
    } else {
      if (patch.parent_id === id) {
        throw new Error("BAD_PARENT");
      }
      const p = await prisma.productCategory.findFirst({
        where: { id: patch.parent_id, tenant_id: tenantId }
      });
      if (!p) {
        throw new Error("BAD_PARENT");
      }
      let walk: { id: number; parent_id: number | null } | null = p;
      while (walk != null) {
        if (walk.id === id) {
          throw new Error("BAD_PARENT");
        }
        if (walk.parent_id == null) break;
        walk = await prisma.productCategory.findFirst({
          where: { id: walk.parent_id, tenant_id: tenantId },
          select: { id: true, parent_id: true }
        });
      }
      const dP = await depthFromRoot(tenantId, patch.parent_id);
      const below = await maxDepthBelow(tenantId, id);
      if (dP + 1 + below > 2) {
        throw new Error("BAD_PARENT");
      }
      data.parent_id = patch.parent_id;
    }
  }
  if (Object.keys(data).length === 0) {
    throw new Error("EMPTY_PATCH");
  }
  const updated = await prisma.productCategory.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      parent_id: true,
      code: true,
      sort_order: true,
      default_unit: true,
      is_active: true,
      comment: true,
      created_at: true
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_category,
    entityId: updated.id,
    action: "update",
    payload: data
  });
  return updated;
}

export async function deleteProductCategoryRow(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<void> {
  const row = await prisma.productCategory.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  const nChild = await prisma.productCategory.count({
    where: { tenant_id: tenantId, parent_id: id }
  });
  if (nChild > 0) {
    throw new Error("HAS_CHILDREN");
  }
  const n = await prisma.product.count({
    where: { tenant_id: tenantId, category_id: id }
  });
  if (n > 0) {
    throw new Error("CATEGORY_IN_USE");
  }
  await prisma.productCategory.delete({ where: { id } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_category,
    entityId: id,
    action: "delete",
    payload: { name: row.name }
  });
}
