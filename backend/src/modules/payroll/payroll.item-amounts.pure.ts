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

export const kpiAmountKey = (id: number) => `kpi:${id}`;

/** `item_amounts` ichidagi `kpi:<id>` summalari. */
export function parseKpiAmounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const m = /^kpi:(\d+)$/.exec(k);
    const n = typeof v === "number" ? v : Number(v);
    if (m && Number.isFinite(n)) out[m[1]!] = n;
  }
  return out;
}

/** Raqamli kalitlarni saqlab, KPI summalarini qo'shadi yoki o'chiradi. */
export function mergeKpiAmounts(prev: unknown, patch: Record<string, number | null>): Record<string, unknown> {
  const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  for (const [k, v] of Object.entries(patch)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0) continue;
    const key = kpiAmountKey(id);
    if (v == null) delete base[key];
    else if (Number.isFinite(v) && v >= 0) base[key] = Math.round(v * 100) / 100;
  }
  return base;
}

export const partVarName = (itemName: string) => `Оклад - ${itemName}`;
