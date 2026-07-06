import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.territory";
import {
  defaultRegionTerritoryCode,
  lalakuExpandRegionFilterTokens,
  normKeyTerritoryMatch,
  REGION_ZONE_ROWS
} from "../../../shared/territory-lalaku-seed";

const CITY_CODE_PREFIX_TERRITORY: { prefix: string; zone: string; region: string }[] = [
  { prefix: "AD_", zone: "FV", region: "ANDIJON VILOYATI" },
  { prefix: "FR_", zone: "FV", region: "FARGONA VILOYATI" },
  { prefix: "NM_", zone: "FV", region: "NAMANGAN VILOYATI" },
  { prefix: "QQ_", zone: "FV", region: "QOQON" },
  { prefix: "BX_", zone: "SOUTH-WEST", region: "BUXORO VILOYATI" },
  { prefix: "JZ_", zone: "SOUTH-WEST", region: "JIZZAX VILOYATI" },
  { prefix: "NK_", zone: "SOUTH-WEST", region: "QORAQALPOQISTON" },
  { prefix: "NV_", zone: "SOUTH-WEST", region: "NAVOIY VILOYATI" },
  { prefix: "QS_", zone: "SOUTH-WEST", region: "QASHQADARYO VILOYATI" },
  { prefix: "SM_", zone: "SOUTH-WEST", region: "SAMARQAND VILOYATI" },
  { prefix: "SR_", zone: "SOUTH-WEST", region: "SURXANDARYO VILOYATI" },
  { prefix: "XR_", zone: "SOUTH-WEST", region: "XORAZM VILOYATI" },
  { prefix: "TV_", zone: "TASH OBL", region: "TOSHKENT VILOYATI" },
  { prefix: "TSH_", zone: "TASHKENT", region: "TOSHKENT SHAHAR" }
];

const CITY_CODE_EXACT: Record<string, { zone: string; region: string }> = {
  FARGONA_VIL: { zone: "FV", region: "FARGONA VILOYATI" }
};

function cascadeKey(zone: string, region: string): string {
  const z = zone.trim();
  const r = region.trim();
  return z ? `${z}|||${r}` : `|||${r}`;
}

function addCitiesToMap(
  map: Record<string, Set<string>>,
  zone: string,
  region: string,
  cities: string[]
) {
  const r = region.trim();
  if (!r) return;
  const key = cascadeKey(zone, region);
  if (!map[key]) map[key] = new Set();
  for (const c of cities) {
    const t = c.trim();
    if (t) map[key].add(t);
  }
}

export function inferCityTerritoryFromCode(city: string): { zone: string; region: string } | null {
  const raw = city.trim();
  if (!raw) return null;
  const exact = CITY_CODE_EXACT[raw.toUpperCase()];
  if (exact) return exact;
  const upper = raw.toUpperCase();
  for (const row of CITY_CODE_PREFIX_TERRITORY) {
    if (upper.startsWith(row.prefix.toUpperCase())) {
      return { zone: row.zone, region: row.region };
    }
  }
  return null;
}

export function isLikelyRegionName(city: string): boolean {
  const u = city.trim().toUpperCase();
  return u.includes("VILOYATI") || u === "QOQON" || u === "QORAQALPOQISTON";
}

/** Viloyat kodi yoki nomi — shahar ro‘yxatiga kiritilmaydi (`ANDIJON_VIL`, `ANDIJON VILOYATI`). */
export function isLikelyRegionStored(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  if (isLikelyRegionName(raw)) return true;
  const upper = raw.toUpperCase();
  if (/_VIL$/.test(upper)) return true;
  const rawNorm = normKeyTerritoryMatch(raw);
  for (const row of REGION_ZONE_ROWS) {
    if (normKeyTerritoryMatch(row.region) === rawNorm) return true;
    const code = defaultRegionTerritoryCode(row.region);
    if (code && code === upper) return true;
  }
  return false;
}

export function regionFilterNormKeys(region: string): Set<string> {
  const out = new Set<string>();
  for (const token of lalakuExpandRegionFilterTokens(region)) {
    const nk = normKeyTerritoryMatch(token);
    if (nk) out.add(nk);
  }
  return out;
}

export function mergeMobileCitiesByZoneRegion(input: {
  fromTree: Record<string, string[]>;
  fromClientRows: Record<string, string[]>;
  cities: string[];
  hints: Record<string, CityTerritoryHintDto>;
}): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};

  const ingest = (src: Record<string, string[]> | undefined) => {
    if (!src) return;
    for (const [key, list] of Object.entries(src)) {
      const parts = key.split("|||");
      const zone = parts.length > 1 ? (parts[0] ?? "") : "";
      const region = parts.length > 1 ? (parts[1] ?? "") : (parts[0] ?? "");
      addCitiesToMap(map, zone, region, list);
    }
  };

  ingest(input.fromTree);
  ingest(input.fromClientRows);

  for (const hint of Object.values(input.hints)) {
    const city = (hint.city_label ?? "").trim();
    const zone = (hint.zone_stored ?? hint.zone_label ?? "").trim();
    const region = (hint.region_stored ?? hint.region_label ?? "").trim();
    if (!city || !region) continue;
    if (!zone && isLikelyRegionName(city)) continue;
    addCitiesToMap(map, zone, region, [city]);
    if (hint.region_label && hint.region_label !== region) {
      addCitiesToMap(map, zone, hint.region_label, [city]);
    }
    if (hint.region_stored && hint.region_stored !== region) {
      addCitiesToMap(map, zone, hint.region_stored, [city]);
    }
  }

  for (const city of input.cities) {
    const inferred = inferCityTerritoryFromCode(city);
    if (inferred) addCitiesToMap(map, inferred.zone, inferred.region, [city]);
  }

  return Object.fromEntries(
    Object.entries(map).map(([k, set]) => [k, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
  );
}
