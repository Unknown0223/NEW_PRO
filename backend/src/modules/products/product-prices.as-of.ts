/**
 * Tanlangan sanadagi (старые цены) narxlarni aniqlash.
 * Manba: `product_price_schedules` (status=applied, effective_at ≤ as_of) + joriy `product_prices` fallback.
 */
import { prisma } from "../../config/database";
import { PRICE_SCHEDULE_STATUS } from "./product-price-schedules.service";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Asia/Tashkent UTC+5 — kalendar kun oxiri. */
export function endOfDayUtcFromYmd(ymd: string): Date {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) {
    throw new Error("BAD_AS_OF");
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 18, 59, 59, 999));
}

export type AsOfPriceRow = {
  product_id: number;
  price: string | null;
  currency: string;
  /** schedule — tarixiy yozuv; current — joriy jadval (tarix yo‘q); missing — topilmadi */
  source: "schedule" | "current" | "missing";
};

export async function resolveProductPricesAsOf(
  tenantId: number,
  priceType: string,
  asOfYmd: string,
  productIds: number[],
  defaultCurrency = "UZS"
): Promise<{ as_of: string; price_type: string; items: AsOfPriceRow[] }> {
  const t = priceType.trim();
  if (!t) throw new Error("VALIDATION");
  const asOf = endOfDayUtcFromYmd(asOfYmd);
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return { as_of: asOfYmd.trim(), price_type: t, items: [] };
  }

  const schedules = await prisma.productPriceSchedule.findMany({
    where: {
      tenant_id: tenantId,
      product_id: { in: ids },
      price_type: t,
      status: PRICE_SCHEDULE_STATUS.applied,
      effective_at: { lte: asOf }
    },
    orderBy: [{ effective_at: "desc" }, { id: "desc" }],
    select: {
      product_id: true,
      price: true,
      currency: true,
      effective_at: true,
      id: true
    }
  });

  const fromSchedule = new Map<number, { price: string; currency: string }>();
  for (const row of schedules) {
    if (fromSchedule.has(row.product_id)) continue;
    fromSchedule.set(row.product_id, {
      price: row.price.toString(),
      currency: row.currency
    });
  }

  const missingIds = ids.filter((id) => !fromSchedule.has(id));
  const currentRows =
    missingIds.length > 0
      ? await prisma.productPrice.findMany({
          where: {
            tenant_id: tenantId,
            product_id: { in: missingIds },
            price_type: t
          },
          select: { product_id: true, price: true, currency: true, updated_at: true, created_at: true }
        })
      : [];

  const fromCurrent = new Map<number, { price: string; currency: string }>();
  for (const row of currentRows) {
    // Tarixiy schedule yo‘q bo‘lsa — joriy narx (yozuvlar kelajakda schedule orqali to‘planadi).
    fromCurrent.set(row.product_id, {
      price: row.price.toString(),
      currency: row.currency
    });
  }

  const items: AsOfPriceRow[] = ids.map((product_id) => {
    const s = fromSchedule.get(product_id);
    if (s) {
      return {
        product_id,
        price: s.price,
        currency: s.currency,
        source: "schedule"
      };
    }
    const c = fromCurrent.get(product_id);
    if (c) {
      return {
        product_id,
        price: c.price,
        currency: c.currency,
        source: "current"
      };
    }
    return {
      product_id,
      price: null,
      currency: defaultCurrency,
      source: "missing"
    };
  });

  return { as_of: asOfYmd.trim(), price_type: t, items };
}

export async function getProductPriceAsOf(
  tenantId: number,
  productId: number,
  priceType: string,
  asOfYmd: string
): Promise<string | null> {
  const resolved = await resolveProductPricesAsOf(tenantId, priceType, asOfYmd, [productId]);
  return resolved.items[0]?.price ?? null;
}
