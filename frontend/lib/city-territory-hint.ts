import { normKeyTerritoryMatch } from "@shared/territory-lalaku-seed";

/**
 * Shahar saqlangan qiymati (masalan `AD_ASAKA`) → ko‘rinadigan nom.
 * API `label` bo‘lsa va koddan farq qilsa — shu label; aks holda `AD_*` prefiksini olib tashlaymiz.
 */
export function cityStoredCodeToDisplayLabel(value: string, apiLabel?: string | null): string {
  const api = (apiLabel ?? "").trim();
  const raw = value.trim();
  if (!raw) return "—";
  if (api && api !== raw) return api;
  const parts = raw.split("_").filter(Boolean);
  if (parts.length >= 2 && /^[A-Z0-9]{2,}$/i.test(parts[0]!)) {
    const tail = parts.slice(1).join(" ");
    if (!tail) return raw.replace(/_/g, " ");
    return tail
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return raw.replace(/_/g, " ");
}

export type CityTerritoryHint = {
  city_label?: string | null;
  region_stored: string | null;
  region_label: string | null;
  zone_stored: string | null;
  zone_label: string | null;
  district_stored: string | null;
  district_label: string | null;
};

export function pickCityTerritoryHint(
  hints: Record<string, CityTerritoryHint> | undefined,
  cityVal: string
): CityTerritoryHint | null {
  if (!hints) return null;
  const t = cityVal.trim();
  if (!t) return null;
  return (
    hints[t] ??
    hints[t.toUpperCase()] ??
    hints[normKeyTerritoryMatch(t)] ??
    null
  );
}
