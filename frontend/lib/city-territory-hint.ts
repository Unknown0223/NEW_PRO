import { normKeyTerritoryMatch } from "@shared/territory-lalaku-seed";

function titleCaseWords(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** `AD_ASAKA` / `AD-ASAKA` / `AD ASAKA` kabi kod ko‘rinishi. */
export function looksLikeTerritoryStoredCode(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  if (/^[A-Z0-9]{2,4}[_-][A-Z0-9][A-Z0-9_-]*$/i.test(raw)) return true;
  if (/^[A-Z0-9]{2,4}\s+[A-Z0-9]/i.test(raw) && raw === raw.toUpperCase()) return true;
  return false;
}

/**
 * Shahar saqlangan qiymati (masalan `AD_ASAKA` / `AD ASAKA`) → ko‘rinadigan nom («Asaka»).
 * API `label` haqiqiy nom bo‘lsa — shu; kodga o‘xshasa — prefiks olib tashlanadi.
 */
export function cityStoredCodeToDisplayLabel(value: string, apiLabel?: string | null): string {
  const api = (apiLabel ?? "").trim();
  const raw = value.trim();
  if (!raw && !api) return "—";

  if (api && api !== raw && !looksLikeTerritoryStoredCode(api)) return api;

  const source = looksLikeTerritoryStoredCode(api) ? api : raw || api;
  const normalized = source.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 2 && /^[A-Z0-9]{2,4}$/i.test(parts[0]!)) {
    const tail = parts.slice(1).join(" ");
    if (!tail) return titleCaseWords(normalized);
    return titleCaseWords(tail);
  }
  if (parts.length >= 1 && source === source.toUpperCase() && /[A-Z]/.test(source)) {
    return titleCaseWords(normalized);
  }
  return normalized || "—";
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
