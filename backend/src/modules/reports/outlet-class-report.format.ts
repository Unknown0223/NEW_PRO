/** Territory + category share foizlari (pure). */

export function formatOutletTerritory(
  zone?: string | null,
  region?: string | null,
  city?: string | null
): string {
  return [zone, region, city]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function formatOutletClientCode(inn?: string | null, clientId?: number | null): string {
  const innTrim = String(inn ?? "").trim();
  if (innTrim) return innTrim;
  if (clientId != null && Number.isFinite(clientId)) return String(clientId);
  return "";
}

/** cat_sum / sales_sum * 100 → `"12.5"` (1 kasr). */
export function formatCategorySharePct(catSum: number, salesSum: number): string {
  if (!Number.isFinite(catSum) || !Number.isFinite(salesSum) || salesSum <= 0) return "0";
  const pct = (catSum / salesSum) * 100;
  if (!Number.isFinite(pct)) return "0";
  return (Math.round(pct * 10) / 10).toFixed(1);
}

export function mergeCategoryShareMaps(
  maps: Array<Record<string, number>>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      out[k] = (out[k] ?? 0) + (Number.isFinite(v) ? v : 0);
    }
  }
  return out;
}

export function sharesToPctRecord(
  amounts: Record<string, number>,
  salesSum: number
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(amounts)) {
    out[k] = formatCategorySharePct(v, salesSum);
  }
  return out;
}

/** Ustun tartibi: jami summa bo‘yicha kamayish. */
export function orderCategoryColumns(totalsByCat: Record<string, number>): string[] {
  return Object.entries(totalsByCat)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .map(([k]) => k);
}
