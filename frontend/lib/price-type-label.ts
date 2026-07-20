/**
 * «Тип цены» kaliti (DB: `price_type` — kod bo‘lsa kod, aks holda nom) →
 * foydalanuvchiga ko‘rinadigan nom. Katalog: `settings.references.price_type_entries`.
 */

export type PriceTypeEntryLike = {
  name?: string | null;
  code?: string | null;
  active?: boolean;
};

/** Katalog bo‘lmaganda tanish kalitlar uchun ruscha nomlar. */
const STATIC_PRICE_TYPE_LABEL_RU: Record<string, string> = {
  retail: "Розница",
  wholesale: "Опт",
  naqd: "Наличные",
  naqd_pul: "Наличные",
  terminal: "Терминал",
  perechisleniye: "Перечисление",
  perechis: "Перечисление",
  old_prices: "Старые цены"
};

/** Kalit (kod yoki nom, katta-kichik farqsiz) → katalogdagi nom. */
export function buildPriceTypeLabelMap(
  entries: PriceTypeEntryLike[] | null | undefined
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries ?? []) {
    const name = (e?.name ?? "").trim();
    if (!name) continue;
    const code = (e?.code ?? "").trim();
    for (const k of [code, name]) {
      if (!k) continue;
      const lk = k.toLowerCase();
      if (!map.has(lk)) map.set(lk, name);
    }
  }
  return map;
}

/** DB kalitini ko‘rsatish uchun nomga aylantiradi; topilmasa kalit o‘zi qaytadi. */
export function priceTypeDisplayLabel(
  raw: string | null | undefined,
  map?: Map<string, string> | null
): string {
  const key = (raw ?? "").trim();
  if (!key) return "";
  const fromMap = map?.get(key.toLowerCase());
  if (fromMap) return fromMap;
  return STATIC_PRICE_TYPE_LABEL_RU[key.toLowerCase()] ?? key;
}

export type PriceTypeOption = { id: string; label: string };

/**
 * `GET /price-types` javobi: `data` — DB kalitlari, `options` — kalit + nom.
 * Eski backend (faqat `data`) bilan ham ishlaydi.
 */
export function priceTypeOptionsFromResponse(body: {
  data?: string[];
  options?: PriceTypeOption[];
}): PriceTypeOption[] {
  if (Array.isArray(body.options) && body.options.length > 0) {
    return body.options.filter((o) => o && o.id);
  }
  return (body.data ?? []).map((id) => ({
    id,
    label: STATIC_PRICE_TYPE_LABEL_RU[id.trim().toLowerCase()] ?? id
  }));
}
