import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import {
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  uniqueSortedPriceTypeKeys
} from "../tenant-settings/finance-refs";
import { settingsRefRecord } from "./reference.shared";

const PRICE_TYPES_CACHE_TTL_SEC = 45;

async function computeDistinctPriceTypesForTenant(
  tenantId: number,
  kind?: "sale" | "purchase"
): Promise<string[]> {
  const rows = await prisma.productPrice.findMany({
    where: { tenant_id: tenantId },
    distinct: ["price_type"],
    select: { price_type: true },
    orderBy: { price_type: "asc" }
  });
  const fromDb = rows.map((r) => r.price_type);
  const ref = await settingsRefRecord(tenantId);
  const entries = priceTypeEntriesFromUnknown(ref.price_type_entries).filter((e) => e.active !== false);
  const filteredCatalogEntries = kind ? entries.filter((e) => e.kind === kind) : entries;
  const fromCatalog = filteredCatalogEntries.map((e) => priceTypeKey(e));

  if (!kind) {
    return uniqueSortedPriceTypeKeys([...fromDb, ...fromCatalog]);
  }

  /** Katalogda shu `kind` uchun yozuvlar bo‘lsa — ro‘yxat faqat shu spravochnikdan (zakaz ≈ «Тип цены» jadvali). */
  if (fromCatalog.length > 0) {
    return uniqueSortedPriceTypeKeys(fromCatalog);
  }

  /**
   * Qattiq rejim: katalog bo‘sh bo‘lsa, DB’dan "legacy" turlarni avtomatik chiqarib yubormaymiz.
   * Aks holda (Excel import / eski ma'lumot) zakaz va filtrlarda "tizimda yo‘q" turlar ko‘rinib qoladi.
   */
  return ["retail"];

  /**
   * `product_prices` qatorlarida `kind` ustuni yo‘q — farq faqat sozlamadagi `price_type_entries.kind`.
   * Katalog bo‘sh bo‘lsa: DB kalitlari + katalog qoldiqlari (legacy).
   */
  const purchaseKeys = new Set(
    entries.filter((e) => e.kind === "purchase").map((e) => priceTypeKey(e).toLowerCase())
  );
  const saleKeys = new Set(entries.filter((e) => e.kind === "sale").map((e) => priceTypeKey(e).toLowerCase()));
  const kindByKey = new Map<string, "sale" | "purchase">(
    entries.map((e) => [priceTypeKey(e).toLowerCase(), e.kind])
  );

  const fromDbFiltered = fromDb.filter((pt) => {
    const k = pt.trim().toLowerCase();
    const entryKind = kindByKey.get(k);
    if (entryKind) return entryKind === kind;
    if (kind === "sale") return !purchaseKeys.has(k);
    return !saleKeys.has(k);
  });

  return uniqueSortedPriceTypeKeys([...fromDbFiltered, ...fromCatalog]);
}

export async function listDistinctPriceTypesForTenant(
  tenantId: number,
  kind?: "sale" | "purchase"
): Promise<string[]> {
  const suffix = kind === "sale" ? "sale" : kind === "purchase" ? "purchase" : "all";
  const cacheKey = `tenant:${tenantId}:price_types:${suffix}`;
  try {
    const redis = await getRedisForApp();
    const hit = await redis.get(cacheKey);
    if (hit) {
      return JSON.parse(hit) as string[];
    }
  } catch {
    /* Redis yo‘q yoki xato — hisoblash */
  }
  const out = await computeDistinctPriceTypesForTenant(tenantId, kind);
  try {
    const redis = await getRedisForApp();
    await redis.set(cacheKey, JSON.stringify(out), "EX", PRICE_TYPES_CACHE_TTL_SEC);
  } catch {
    /* ignore */
  }
  return out;
}
