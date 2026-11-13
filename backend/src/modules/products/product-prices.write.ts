import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  shouldSnapshotPreviousPrice,
  snapshotEffectiveAt
} from "./product-prices.as-of.pure";
import { listProductPrices, type PriceRow } from "./product-prices.read";
import { PRICE_SCHEDULE_STATUS } from "./product-price-schedules.service";

export type PriceInputItem = { price_type: string; price: number };

type TxClient = Prisma.TransactionClient;

/** Eski narxni schedule ga yozish (старые цены uchun); keyin yangi narx yoziladi. */
async function snapshotPreviousPricesInTx(
  tx: TxClient,
  input: {
    tenantId: number;
    priceType: string;
    currency: string;
    now: Date;
    actorUserId: number | null;
    nextByProductId: Map<number, Prisma.Decimal>;
  }
): Promise<void> {
  const ids = [...input.nextByProductId.keys()];
  if (ids.length === 0) return;

  const existing = await tx.productPrice.findMany({
    where: {
      tenant_id: input.tenantId,
      product_id: { in: ids },
      price_type: input.priceType
    },
    select: {
      product_id: true,
      price: true,
      currency: true,
      created_at: true,
      updated_at: true
    }
  });
  if (existing.length === 0) return;

  const latestSchedules = await tx.productPriceSchedule.findMany({
    where: {
      tenant_id: input.tenantId,
      product_id: { in: ids },
      price_type: input.priceType,
      status: PRICE_SCHEDULE_STATUS.applied,
      effective_at: { lte: input.now }
    },
    orderBy: [{ effective_at: "desc" }, { id: "desc" }],
    select: { product_id: true, price: true }
  });
  const latestByProduct = new Map<number, string>();
  for (const row of latestSchedules) {
    if (latestByProduct.has(row.product_id)) continue;
    latestByProduct.set(row.product_id, row.price.toString());
  }

  const snapshots: Array<{
    tenant_id: number;
    product_id: number;
    price_type: string;
    price: Prisma.Decimal;
    currency: string;
    effective_at: Date;
    status: string;
    applied_at: Date;
    created_by?: number;
  }> = [];

  for (const row of existing) {
    const next = input.nextByProductId.get(row.product_id);
    if (next == null) continue;
    const prev = row.price.toString();
    const latest = latestByProduct.get(row.product_id) ?? null;
    if (
      !shouldSnapshotPreviousPrice({
        previousPrice: prev,
        nextPrice: next.toString(),
        latestSchedulePrice: latest
      })
    ) {
      continue;
    }
    const hasPriorSchedule = latest != null;
    snapshots.push({
      tenant_id: input.tenantId,
      product_id: row.product_id,
      price_type: input.priceType,
      price: row.price,
      currency: row.currency?.trim() || input.currency,
      effective_at: snapshotEffectiveAt({
        now: input.now,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        hasPriorSchedule
      }),
      status: PRICE_SCHEDULE_STATUS.applied,
      applied_at: input.now,
      ...(input.actorUserId != null && input.actorUserId > 0
        ? { created_by: input.actorUserId }
        : {})
    });
  }

  if (snapshots.length > 0) {
    await tx.productPriceSchedule.createMany({ data: snapshots });
  }
}

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
    const now = new Date();
    if (items.length > 0) {
      // Har bir tip uchun alohida eski narx snapshot.
      const byType = new Map<string, Map<number, Prisma.Decimal>>();
      for (const it of items) {
        const t = it.price_type.trim();
        let m = byType.get(t);
        if (!m) {
          m = new Map();
          byType.set(t, m);
        }
        m.set(productId, new Prisma.Decimal(it.price));
      }
      for (const [priceType, nextByProductId] of byType) {
        await snapshotPreviousPricesInTx(tx, {
          tenantId,
          priceType,
          currency: "UZS",
          now,
          actorUserId,
          nextByProductId
        });
      }
    }
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
    // Старые цены / as-of: yangi narx ham tarixga yoziladi.
    await tx.productPriceSchedule.createMany({
      data: items.map((it) => ({
        tenant_id: tenantId,
        product_id: productId,
        price_type: it.price_type.trim(),
        price: new Prisma.Decimal(it.price),
        currency: "UZS",
        effective_at: now,
        status: PRICE_SCHEDULE_STATUS.applied,
        applied_at: now,
        created_by: actorUserId ?? undefined
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

  const now = new Date();
  const cur = currency.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "UZS";

  await prisma.$transaction(async (tx) => {
    const nextByProductId = new Map(
      items.map((it) => [it.product_id, new Prisma.Decimal(it.price)] as const)
    );
    await snapshotPreviousPricesInTx(tx, {
      tenantId,
      priceType: t,
      currency: cur,
      now,
      actorUserId,
      nextByProductId
    });

    for (const it of items) {
      await tx.productPrice.upsert({
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
          currency: cur
        },
        update: {
          price: new Prisma.Decimal(it.price),
          currency: cur
        }
      });
    }
    // Старые цены / as-of: yangi narx tarix sifatida saqlanadi.
    await tx.productPriceSchedule.createMany({
      data: items.map((it) => ({
        tenant_id: tenantId,
        product_id: it.product_id,
        price_type: t,
        price: new Prisma.Decimal(it.price),
        currency: cur,
        effective_at: now,
        status: PRICE_SCHEDULE_STATUS.applied,
        applied_at: now,
        created_by: actorUserId ?? undefined
      }))
    });
  });

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
