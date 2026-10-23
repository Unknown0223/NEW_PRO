/**
 * Mahsulot birligi — katalogda tanlanadigan standart qiymatlar (DB `products.unit` string).
 * "Boshqa" tanlansa bepul matn kiritiladi (maxsus birliklar uchun).
 */
export const PRODUCT_UNIT_CUSTOM = "__custom__";

export const PRODUCT_UNIT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "dona", label: "шт." },
  { value: "quti", label: "коробка" },
  { value: "blok", label: "блок" },
  { value: "paket", label: "пакет" },
  { value: "karobka", label: "короб" },
  { value: "pachka", label: "пачка" },
  { value: "rulon", label: "рулон" },
  { value: "komplekt", label: "комплект" },
  { value: "kg", label: "кг" },
  { value: "g", label: "г" },
  { value: "tonna", label: "тонна" },
  { value: "litr", label: "литр" },
  { value: "ml", label: "мл" },
  { value: "m", label: "м" },
  { value: "m2", label: "м²" },
  { value: "m3", label: "м³" },
  { value: "qadoq", label: "упаковка" },
  { value: "bo‘lak", label: "кусок" },
  { value: PRODUCT_UNIT_CUSTOM, label: "Другое (ввести вручную)…" }
];

const STANDARD_VALUES = new Set(
  PRODUCT_UNIT_OPTIONS.filter((o) => o.value !== PRODUCT_UNIT_CUSTOM).map((o) => o.value)
);

export function isStandardProductUnit(unit: string): boolean {
  return STANDARD_VALUES.has(unit.trim());
}

export function splitUnitForForm(stored: string): { select: string; custom: string } {
  const u = stored.trim();
  if (!u) return { select: "dona", custom: "" };
  if (isStandardProductUnit(u)) return { select: u, custom: "" };
  return { select: PRODUCT_UNIT_CUSTOM, custom: u };
}

export function resolveUnitFromForm(select: string, custom: string): string {
  if (select === PRODUCT_UNIT_CUSTOM) return custom.trim() || "dona";
  return select;
}
