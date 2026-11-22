/**
 * Buyurtma / bonus-preview uchun narx turi kalitini normalizatsiya qiladi.
 * Mobil ba'zan placeholder (`default`) yuboradi; UI boshqa turdagi narxni
 * ko‘rsatishi mumkin — backend esa aniq kalit bo‘yicha qidiradi → NoPrice.
 */

const PLACEHOLDER_PRICE_TYPES = new Set([
  "default",
  "auto",
  "none",
  "null",
  "undefined",
  "-"
]);

export function isUnsetOrderPriceType(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return true;
  return PLACEHOLDER_PRICE_TYPES.has(t.toLowerCase());
}

/**
 * 1) so‘ralgan haqiqiy kalit
 * 2) mijozning price_type
 * 3) katalogdagi birinchi sale turi
 * 4) fallback (odatda retail)
 */
export function resolveEffectiveOrderPriceType(input: {
  requested?: string | null;
  clientPriceType?: string | null;
  catalogPriceTypes?: readonly string[] | null;
  fallback?: string;
}): string {
  const requested = (input.requested ?? "").trim();
  if (!isUnsetOrderPriceType(requested)) return requested;

  const client = (input.clientPriceType ?? "").trim();
  if (!isUnsetOrderPriceType(client)) return client;

  const catalog = (input.catalogPriceTypes ?? [])
    .map((s) => s.trim())
    .filter((s) => !isUnsetOrderPriceType(s));
  if (catalog.length > 0) return catalog[0]!;

  const fallback = (input.fallback ?? "retail").trim();
  return fallback || "retail";
}
