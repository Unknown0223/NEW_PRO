import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildCityTerritoryHints,
  expandRegionFilterSynonyms,
  referencesWithResolvedTerritoryNodes
} from "../tenant-settings/tenant-settings.service";
import { territoryCityStoredPairs } from "../tenant-settings/tenant-settings.territory";
import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.service";
import { normKeyTerritoryMatch } from "../../../shared/territory-lalaku-seed";
import {
  cityStartsWithPrefixesForRegion,
  cityStartsWithPrefixesForZone
} from "../mobile/mobile-territory-references";

export type ClientTerritoryFilterBundle = {
  hints: Record<string, CityTerritoryHintDto>;
  ref: Record<string, unknown> | undefined;
};

export async function loadClientTerritoryFilterBundle(
  tenantId: number
): Promise<ClientTerritoryFilterBundle> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refRaw = (row?.settings as { references?: Record<string, unknown> } | null)?.references as
    | Record<string, unknown>
    | undefined;
  const ref = refRaw ? referencesWithResolvedTerritoryNodes(refRaw) : undefined;
  return {
    hints: buildCityTerritoryHints(ref),
    ref
  };
}

export function cityKeysMatchingRegionInHints(
  hints: Record<string, CityTerritoryHintDto>,
  regionFilter: string | string[]
): string[] {
  const filters = [
    ...new Set(
      (Array.isArray(regionFilter) ? regionFilter : [regionFilter]).map((x) => x.trim()).filter(Boolean)
    )
  ];
  if (filters.length === 0) return [];
  const exact = new Set(filters);
  const norms = new Set(filters.map((f) => normKeyTerritoryMatch(f)));
  const uniq = new Set<string>();
  for (const [cityKey, hint] of Object.entries(hints)) {
    const rs = (hint.region_stored ?? "").trim();
    const rl = (hint.region_label ?? "").trim();
    if (!rs && !rl) continue;
    const match =
      exact.has(rs) ||
      exact.has(rl) ||
      (rs.length > 0 && norms.has(normKeyTerritoryMatch(rs))) ||
      (rl.length > 0 && norms.has(normKeyTerritoryMatch(rl)));
    if (match) {
      const k = cityKey.trim();
      if (k) uniq.add(k);
    }
  }
  return [...uniq];
}

export function cityKeysMatchingZoneInHints(
  hints: Record<string, CityTerritoryHintDto>,
  zoneFilter: string
): string[] {
  const zf = zoneFilter.trim();
  if (!zf) return [];
  const zfNorm = normKeyTerritoryMatch(zf);
  const uniq = new Set<string>();
  for (const [cityKey, hint] of Object.entries(hints)) {
    const zs = (hint.zone_stored ?? "").trim();
    const zl = (hint.zone_label ?? "").trim();
    if (!zs && !zl) continue;
    const match =
      zs === zf ||
      zl === zf ||
      normKeyTerritoryMatch(zs) === zfNorm ||
      normKeyTerritoryMatch(zl) === zfNorm;
    if (match) {
      const k = cityKey.trim();
      if (k) uniq.add(k);
    }
  }
  return [...uniq];
}

/** Shahar filtri: UI daraxt nomi yoki kod — `clients.city` dagi kod va nom. */
export function expandCityFilterValues(
  bundle: ClientTerritoryFilterBundle,
  cityFilters: string[]
): string[] {
  const out = new Set<string>();
  const pairs = territoryCityStoredPairs(bundle.ref);
  for (const raw of cityFilters) {
    const c = raw.trim();
    if (!c) continue;
    out.add(c);
    const norm = normKeyTerritoryMatch(c);
    for (const { stored, name } of pairs) {
      const matches =
        stored === c ||
        name === c ||
        normKeyTerritoryMatch(stored) === norm ||
        normKeyTerritoryMatch(name) === norm;
      if (matches) {
        if (stored) out.add(stored);
        if (name) out.add(name);
      }
    }
    for (const [key, hint] of Object.entries(bundle.hints)) {
      const label = (hint.city_label ?? "").trim();
      const keyHit =
        key === c ||
        key.toUpperCase() === c.toUpperCase() ||
        (norm.length > 0 && normKeyTerritoryMatch(key) === norm);
      const labelHit =
        label.length > 0 &&
        (label === c || normKeyTerritoryMatch(label) === norm);
      if (keyHit || labelHit) {
        if (label) out.add(label);
        if (key.trim()) out.add(key.trim());
      }
    }
  }
  return [...out].filter((x) => x.length > 0 && x.length <= 80);
}

export function clientWhereForCityFilter(
  bundle: ClientTerritoryFilterBundle,
  cityFilters: string[]
): Prisma.ClientWhereInput | null {
  const values = expandCityFilterValues(bundle, cityFilters);
  if (values.length === 0) return null;
  return {
    OR: values.map((v) => ({ city: { equals: v, mode: "insensitive" as const } }))
  };
}

export function clientWhereForRegionFilter(
  bundle: ClientTerritoryFilterBundle,
  regionFilters: string[]
): Prisma.ClientWhereInput | null {
  const regions = [...new Set(regionFilters.map((r) => r.trim()).filter(Boolean))];
  if (regions.length === 0) return null;
  const or: Prisma.ClientWhereInput[] = [];
  for (const regionQ of regions) {
    const synonyms = expandRegionFilterSynonyms(bundle.ref, regionQ);
    const uniqSyn = synonyms.length > 0 ? synonyms : [regionQ];
    for (const v of uniqSyn) {
      or.push({ region: { equals: v, mode: "insensitive" } });
      or.push({ region: { contains: v, mode: "insensitive" } });
    }
    const cityKeys = cityKeysMatchingRegionInHints(bundle.hints, uniqSyn);
    if (cityKeys.length > 0) or.push({ city: { in: cityKeys } });
    for (const prefix of cityStartsWithPrefixesForRegion(regionQ)) {
      or.push({ city: { startsWith: prefix, mode: "insensitive" } });
    }
  }
  return or.length > 0 ? { OR: or } : null;
}

export function clientWhereForZoneFilter(
  bundle: ClientTerritoryFilterBundle,
  zoneFilters: string[]
): Prisma.ClientWhereInput | null {
  const zones = [...new Set(zoneFilters.map((z) => z.trim()).filter(Boolean))];
  if (zones.length === 0) return null;
  const or: Prisma.ClientWhereInput[] = [];
  for (const zoneQ of zones) {
    or.push({ zone: { equals: zoneQ, mode: "insensitive" } });
    or.push({ zone: { contains: zoneQ, mode: "insensitive" } });
    const cityKeys = cityKeysMatchingZoneInHints(bundle.hints, zoneQ);
    if (cityKeys.length > 0) or.push({ city: { in: cityKeys } });
    for (const prefix of cityStartsWithPrefixesForZone(zoneQ)) {
      or.push({ city: { startsWith: prefix, mode: "insensitive" } });
    }
  }
  return { OR: or };
}
