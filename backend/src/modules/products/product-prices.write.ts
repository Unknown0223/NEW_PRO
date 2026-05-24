import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { listProductPrices, type PriceRow } from "./product-prices.read";

export type PriceInputItem = { price_type: string; price: number };

export async function syncProductPrices(
  tenantId: number,
  productId: number,
  items: PriceInputItem[],
  actorUserId: number | null = null
): Promise<PriceRow[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenant_id: tenantId }
  });
  if (!product) {
    throw new Error("NOT_FOUND");
  }
  for (const it of items) {
    const t = it.price_type.trim();
    if (!t || it.price < 0 || !Number.isFinite(it.price)) {
      throw new Error("VALIDATION");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productPrice.deleteMany({
      where: { tenant_id: tenantId, product_id: productId }
    });
    if (items.length === 0) return;
    await tx.productPrice.createMany({
      data: items.map((it) => ({
        tenant_id: tenantId,
        product_id: productId,
        price_type: it.price_type.trim(),
        price: new Prisma.Decimal(it.price)
      }))
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_price,
    entityId: productId,
    action: "sync",
    payload: {
      item_count: items.length,
      types: items.map((i) => i.price_type.trim())
    }
  });

  void invalidatePriceTypesCache(tenantId);
  return listProductPrices(tenantId, productId);
}

export async function saveMatrixPrices(
  tenantId: number,
  priceType: string,
  items: { product_id: number; price: number }[],
  currency: string,
  actorUserId: number | null,
  categoryIds: number[] | null,
  effectiveAt: Date | null
): Promise<{ mode: "immediate" | "scheduled"; count: number; effective_at?: string }> {
  const effective = effectiveAt ?? new Date();
  if (effective.getTime() > Date.now() + 1000) {
    const { scheduleProductPrices } = await import("./product-price-schedules.service");
    const { scheduled } = await scheduleProductPrices(
      tenantId,
      priceType,
      items,
      currency,
      effective,
      actorUserId,
      categoryIds
    );
    return {
      mode: "scheduled",
      count: scheduled,
      effective_at: effective.toISOString()
    };
  }
  await bulkUpsertPricesForType(
    tenantId,
    priceType,
    items,
    currency,
    actorUserId,
    categoryIds != null && categoryIds.length === 1 ? categoryIds[0]! : null
  );
  return { mode: "immediate", count: items.length };
}

export async function bulkUpsertPricesForType(
  tenantId: number,
  priceType: string,
  items: { product_id: number; price: number }[],
  currency: string,
  actorUserId: number | null = null,
  categoryId: number | null = null
): Promise<void> {
  const t = priceType.trim();
  if (!t) {
    throw new Error("VALIDATION");
  }
  if (items.length === 0) {
    throw new Error("VALIDATION");
  }
  for (const it of items) {
    if (!Number.isFinite(it.price) || it.price < 0) {
      throw new Error("VALIDATION");
    }
  }
  const ids = [...new Set(items.map((i) => i.product_id))];
  const productWhere: { tenant_id: number; id: { in: number[] }; category_id?: number } = {
    tenant_id: tenantId,
    id: { in: ids }
  };
  if (categoryId != null && categoryId > 0) {
    productWhere.category_id = categoryId;
  }
  const products = await prisma.product.findMany({
    where: productWhere,
    select: { id: true }
  });
  if (products.length !== ids.length) {
    throw new Error(categoryId != null && categoryId > 0 ? "VALIDATION" : "NOT_FOUND");
  }

  await prisma.$transaction(
    items.map((it) =>
      prisma.productPrice.upsert({
        where: {
          tenant_id_product_id_price_type: {
            tenant_id: tenantId,
            product_id: it.product_id,
            price_type: t
          }
        },
        create: {
          tenant_id: tenantId,
          product_id: it.product_id,
          price_type: t,
          price: new Prisma.Decimal(it.price),
          currency
        },
        update: {
          price: new Prisma.Decimal(it.price),
          currency
        }
      })
    )
  );

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_price,
    entityId: `matrix:${t}`,
    action: "bulk.matrix",
    payload: { price_type: t, count: items.length }
  });
  void invalidatePriceTypesCache(tenantId);
}
