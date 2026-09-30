/** JSON → { "<item_id>": amount } (faqat musbat butun id va chekli summa). */
export function parseItemAmounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(id) && id > 0 && Number.isFinite(n)) out[String(id)] = n;
  }
  return out;
}

/** null — o'chirish; aks holda yozish. */
export function mergeItemAmounts(prev: unknown, patch: Record<string, number | null>): Record<string, number> {
  const out = parseItemAmounts(prev);
  for (const [k, v] of Object.entries(patch)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (v == null) delete out[String(id)];
    else if (Number.isFinite(v) && v >= 0) out[String(id)] = Math.round(v * 100) / 100;
  }
  return out;
}

export const partVarName = (itemName: string) => `Оклад - ${itemName}`;
