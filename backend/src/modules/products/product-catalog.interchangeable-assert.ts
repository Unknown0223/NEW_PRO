import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { InterchangeableExchangeLookupRow } from "./product-catalog.types";

async function interchangeableGroupIdsForProduct(tenantId: number, productId: number): Promise<number[]> {
  const rows = await prisma.interchangeableGroupProduct.findMany({
    where: {
      product_id: productId,
      group: { tenant_id: tenantId, is_active: true }
    },
    select: { group_id: true }
  });
  return rows.map((r) => r.group_id);
}

/**
 * Obmen: barcha minus va plus mahsulotlar bitta faol interchangeable guruhida;
 * guruhda price_types bo‘lsa, joriy price_type ro‘yxatda bo‘lishi kerak.
 */
export async function assertExchangeInterchangeableProducts(
  tenantId: number,
  minusProductIds: number[],
  plusProductIds: number[],
  priceType: string
): Promise<{ groupId: number; allowedProductIds: number[] }> {
  const minusU = [...new Set(minusProductIds.filter((x) => Number.isInteger(x) && x > 0))];
  const plusU = [...new Set(plusProductIds.filter((x) => Number.isInteger(x) && x > 0))];
  if (minusU.length < 1 || plusU.length < 1) {
    throw new Error("EXCHANGE_INTERCHANGEABLE_INCOMPLETE");
  }

  const candidates = await interchangeableGroupIdsForProduct(tenantId, minusU[0]!);
  for (const gid of candidates) {
    const g = await prisma.interchangeableProductGroup.findFirst({
      where: { id: gid, tenant_id: tenantId, is_active: true },
      include: {
        products: { select: { product_id: true } },
        price_type_links: { select: { price_type: true } }
      }
    });
    if (!g) continue;
    const allowedSet = new Set(g.products.map((p) => p.product_id));
    if (!minusU.every((pid) => allowedSet.has(pid)) || !plusU.every((pid) => allowedSet.has(pid))) {
      continue;
    }
    const pts = g.price_type_links.map((x) => x.price_type);
    if (pts.length > 0 && !pts.includes(priceType)) {
      continue;
    }
    return { groupId: g.id, allowedProductIds: [...allowedSet] };
  }

  throw new Error("EXCHANGE_NO_INTERCHANGEABLE_GROUP");
}

/**
 * Qaytarish (polki / oddiy return): har bir mahsulot kamida bitta faol interchangeable
 * guruhda; guruhda price_types bo‘lsa, `priceType` ro‘yxatda bo‘lishi kerak (exchange bilan bir xil).
 */
export async function assertReturnProductsInterchangeableStrict(
  tenantId: number,
  productIds: number[],
  priceType: string
): Promise<void> {
  const ids = [...new Set(productIds.filter((x) => Number.isInteger(x) && x > 0))];
  if (ids.length === 0) return;

  const pt = (priceType ?? "").trim() || "retail";

  const links = await prisma.interchangeableGroupProduct.findMany({
    where: {
      product_id: { in: ids },
      group: { tenant_id: tenantId, is_active: true }
    },
    include: {
      group: {
        include: {
          price_type_links: { select: { price_type: true } }
        }
      }
    }
  });

  const eligible = new Map<number, boolean>();
  for (const pid of ids) eligible.set(pid, false);

  for (const row of links) {
    const pts = row.group.price_type_links.map((x) => x.price_type);
    if (pts.length > 0 && !pts.includes(pt)) continue;
    eligible.set(row.product_id, true);
  }

  for (const pid of ids) {
    if (!eligible.get(pid)) {
      const err = new Error("RETURN_NOT_INTERCHANGEABLE") as Error & { product_id?: number };
      err.product_id = pid;
      throw err;
    }
  }
}

/** Bitta mahsulot bo‘yicha obmen (+) uchun ruxsat etilgan guruh va mahsulotlar */
export async function getInterchangeableExchangeLookupForProduct(
  tenantId: number,
  productId: number,
  priceType: string
): Promise<InterchangeableExchangeLookupRow | null> {
  const gids = await interchangeableGroupIdsForProduct(tenantId, productId);
  if (gids.length === 0) return null;
  const gid = gids[0]!;
  const g = await prisma.interchangeableProductGroup.findFirst({
    where: { id: gid, tenant_id: tenantId, is_active: true },
    include: {
      products: {
        include: {
          product: { select: { id: true, sku: true, name: true } }
        }
      },
      price_type_links: true
    }
  });
  if (!g) return null;
  const pts = g.price_type_links.map((x) => x.price_type);
  if (pts.length > 0 && !pts.includes(priceType)) {
    return null;
  }
  return {
    group_id: g.id,
    group_name: g.name,
    price_types: pts,
    products: g.products.map((l) => l.product)
  };
}
