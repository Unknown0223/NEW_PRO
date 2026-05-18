import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import { productListInclude, assertProductCatalogFks, decOpt } from "./products.shared";
import type { CreateProductInput, UpdateProductInput } from "./products.types";

export async function createProduct(
  tenantId: number,
  input: CreateProductInput,
  actorUserId: number | null = null
) {
  const sku = input.sku.trim();
  const name = input.name.trim();
  if (!sku || !name) {
    throw new Error("VALIDATION");
  }
  if (input.category_id == null || input.category_id < 1) {
    throw new Error("BAD_CATEGORY");
  }
  const exists = await prisma.product.findUnique({
    where: { tenant_id_sku: { tenant_id: tenantId, sku } }
  });
  if (exists) {
    const err = new Error("SKU_EXISTS");
    throw err;
  }
  await assertProductCatalogFks(tenantId, {
    category_id: input.category_id ?? null,
    product_group_id: input.product_group_id ?? null,
    brand_id: input.brand_id ?? null,
    manufacturer_id: input.manufacturer_id ?? null,
    segment_id: input.segment_id ?? null
  });

  const data: Prisma.ProductUncheckedCreateInput = {
    tenant_id: tenantId,
    sku,
    name,
    unit: (input.unit ?? "dona").trim() || "dona",
    barcode: input.barcode?.trim() || null,
    category_id: input.category_id ?? null,
    is_active: input.is_active ?? true,
    product_group_id: input.product_group_id ?? null,
    brand_id: input.brand_id ?? null,
    manufacturer_id: input.manufacturer_id ?? null,
    segment_id: input.segment_id ?? null,
    weight_kg: decOpt(input.weight_kg) ?? null,
    volume_m3: decOpt(input.volume_m3) ?? null,
    qty_per_block: input.qty_per_block ?? null,
    dimension_unit: input.dimension_unit?.trim().slice(0, 8) || null,
    width_cm: decOpt(input.width_cm) ?? null,
    height_cm: decOpt(input.height_cm) ?? null,
    length_cm: decOpt(input.length_cm) ?? null,
    ikpu_code: input.ikpu_code?.trim().slice(0, 64) || null,
    hs_code: input.hs_code?.trim().slice(0, 32) || null,
    sell_code: input.sell_code?.trim().slice(0, 64) || null,
    comment: input.comment?.trim() || null,
    sort_order: input.sort_order ?? null,
    is_blocked: input.is_blocked ?? false,
    is_equipment: input.is_equipment ?? false
  };

  await prisma.product.create({ data });
  const row = await prisma.product.findFirstOrThrow({
    where: { tenant_id: tenantId, sku },
    include: productListInclude
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product,
    entityId: row.id,
    action: "create",
    payload: row
  });
  return row;
}

export async function updateProduct(
  tenantId: number,
  productId: number,
  input: UpdateProductInput,
  actorUserId: number | null = null
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenant_id: tenantId }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  if (input.sku !== undefined && input.sku.trim() !== existing.sku) {
    const clash = await prisma.product.findFirst({
      where: { tenant_id: tenantId, sku: input.sku.trim(), NOT: { id: productId } }
    });
    if (clash) {
      throw new Error("SKU_EXISTS");
    }
  }
  await assertProductCatalogFks(tenantId, {
    category_id:
      input.category_id !== undefined ? input.category_id : existing.category_id,
    product_group_id:
      input.product_group_id !== undefined ? input.product_group_id : existing.product_group_id,
    brand_id: input.brand_id !== undefined ? input.brand_id : existing.brand_id,
    manufacturer_id:
      input.manufacturer_id !== undefined ? input.manufacturer_id : existing.manufacturer_id,
    segment_id: input.segment_id !== undefined ? input.segment_id : existing.segment_id
  });

  const data: Prisma.ProductUncheckedUpdateInput = {};
  if (input.sku !== undefined) data.sku = input.sku.trim();
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.unit !== undefined) data.unit = input.unit.trim() || "dona";
  if (input.barcode !== undefined) data.barcode = input.barcode?.trim() || null;
  if (input.category_id !== undefined) data.category_id = input.category_id;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.product_group_id !== undefined) data.product_group_id = input.product_group_id;
  if (input.brand_id !== undefined) data.brand_id = input.brand_id;
  if (input.manufacturer_id !== undefined) data.manufacturer_id = input.manufacturer_id;
  if (input.segment_id !== undefined) data.segment_id = input.segment_id;
  if (input.weight_kg !== undefined) data.weight_kg = decOpt(input.weight_kg) ?? null;
  if (input.volume_m3 !== undefined) data.volume_m3 = decOpt(input.volume_m3) ?? null;
  if (input.qty_per_block !== undefined) data.qty_per_block = input.qty_per_block;
  if (input.dimension_unit !== undefined) {
    data.dimension_unit = input.dimension_unit?.trim().slice(0, 8) || null;
  }
  if (input.width_cm !== undefined) data.width_cm = decOpt(input.width_cm) ?? null;
  if (input.height_cm !== undefined) data.height_cm = decOpt(input.height_cm) ?? null;
  if (input.length_cm !== undefined) data.length_cm = decOpt(input.length_cm) ?? null;
  if (input.ikpu_code !== undefined) data.ikpu_code = input.ikpu_code?.trim().slice(0, 64) || null;
  if (input.hs_code !== undefined) data.hs_code = input.hs_code?.trim().slice(0, 32) || null;
  if (input.sell_code !== undefined) data.sell_code = input.sell_code?.trim().slice(0, 64) || null;
  if (input.comment !== undefined) data.comment = input.comment?.trim() || null;
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.is_blocked !== undefined) data.is_blocked = input.is_blocked;
  if (input.is_equipment !== undefined) data.is_equipment = input.is_equipment;

  await prisma.product.update({
    where: { id: productId },
    data
  });
  const row = await prisma.product.findFirstOrThrow({
    where: { id: productId, tenant_id: tenantId },
    include: productListInclude
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product,
    entityId: productId,
    action: "update",
    payload: data
  });
  return row;
}

/** Ma’lumotlar bazasidan qator o‘chirilmaydi — faqat `is_active: false` (neaktiv). */
export async function softDeleteProduct(
  tenantId: number,
  productId: number,
  actorUserId: number | null = null
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenant_id: tenantId }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  const row = await prisma.product.update({
    where: { id: productId },
    data: { is_active: false },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      barcode: true,
      is_active: true,
      category_id: true
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product,
    entityId: productId,
    action: "soft_delete",
    payload: { sku: row.sku, is_active: false }
  });
  return row;
}
