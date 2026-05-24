import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

export const PRICE_SCHEDULE_STATUS = {
  pending: "pending",
  applied: "applied",
  cancelled: "cancelled"
} as const;

export type SchedulePriceItem = { product_id: number; price: number };

export async function scheduleProductPrices(
  tenantId: number,
  priceType: string,
  items: SchedulePriceItem[],
  currency: string,
  effectiveAt: Date,
  actorUserId: number | null = null,
  categoryIds: number[] | null = null
): Promise<{ scheduled: number }> {
  const t = priceType.trim();
  if (!t || items.length === 0) {
    throw new Error("VALIDATION");
  }
  if (effectiveAt.getTime() <= Date.now()) {
    throw new Error("VALIDATION");
  }
  for (const it of items) {
    if (!Number.isFinite(it.price) || it.price < 0) {
      throw new Error("VALIDATION");
    }
  }

  const ids = [...new Set(items.map((i) => i.product_id))];
  const productWhere: { tenant_id: number; id: { in: number[] }; category_id?: { in: number[] } } = {
    tenant_id: tenantId,
    id: { in: ids }
  };
  if (categoryIds != null && categoryIds.length > 0) {
    productWhere.category_id = { in: categoryIds };
  }
  const products = await prisma.product.findMany({
    where: productWhere,
    select: { id: true }
  });
  if (products.length !== ids.length) {
    throw new Error("VALIDATION");
  }

  const cur = currency.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "UZS";

  await prisma.$transaction(async (tx) => {
    await tx.productPriceSchedule.updateMany({
      where: {
        tenant_id: tenantId,
        product_id: { in: ids },
        price_type: t,
        status: PRICE_SCHEDULE_STATUS.pending
      },
      data: { status: PRICE_SCHEDULE_STATUS.cancelled }
    });

    await tx.productPriceSchedule.createMany({
      data: items.map((it) => ({
        tenant_id: tenantId,
        product_id: it.product_id,
        price_type: t,
        price: new Prisma.Decimal(it.price),
        currency: cur,
        effective_at: effectiveAt,
        status: PRICE_SCHEDULE_STATUS.pending,
        created_by: actorUserId ?? undefined
      }))
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.product_price,
    entityId: `schedule:${t}`,
    action: "schedule.matrix",
    payload: {
      price_type: t,
      count: items.length,
      effective_at: effectiveAt.toISOString()
    }
  });

  return { scheduled: items.length };
}

export type ApplySchedulesResult = { applied: number; tenant_ids: number[] };

/** Cron yoki test: muddati kelgan `pending` rejalarni `product_prices` ga yozadi. */
export async function applyDueProductPriceSchedules(now = new Date()): Promise<ApplySchedulesResult> {
  const due = await prisma.productPriceSchedule.findMany({
    where: {
      status: PRICE_SCHEDULE_STATUS.pending,
      effective_at: { lte: now }
    },
    orderBy: [{ effective_at: "asc" }, { id: "asc" }],
    take: 5000
  });

  if (due.length === 0) {
    return { applied: 0, tenant_ids: [] };
  }

  const byTenant = new Map<number, typeof due>();
  for (const row of due) {
    const arr = byTenant.get(row.tenant_id) ?? [];
    arr.push(row);
    byTenant.set(row.tenant_id, arr);
  }

  let applied = 0;
  const tenantIds: number[] = [];

  for (const [tenantId, rows] of byTenant) {
    tenantIds.push(tenantId);
    const byType = new Map<string, typeof rows>();
    for (const row of rows) {
      const arr = byType.get(row.price_type) ?? [];
      arr.push(row);
      byType.set(row.price_type, arr);
    }

    for (const [priceType, typeRows] of byType) {
      const currency = typeRows[0]?.currency ?? "UZS";
      const t = priceType.trim();

      await prisma.$transaction([
        ...typeRows.map((row) =>
          prisma.productPrice.upsert({
            where: {
              tenant_id_product_id_price_type: {
                tenant_id: tenantId,
                product_id: row.product_id,
                price_type: t
              }
            },
            create: {
              tenant_id: tenantId,
              product_id: row.product_id,
              price_type: t,
              price: row.price,
              currency
            },
            update: {
              price: row.price,
              currency
            }
          })
        ),
        prisma.productPriceSchedule.updateMany({
          where: { id: { in: typeRows.map((r) => r.id) } },
          data: {
            status: PRICE_SCHEDULE_STATUS.applied,
            applied_at: now
          }
        })
      ]);

      applied += typeRows.length;
    }

    void invalidatePriceTypesCache(tenantId);
  }

  return { applied, tenant_ids: tenantIds };
}
