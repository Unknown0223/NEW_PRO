import { prisma } from "../../config/database";
import type { TerritoryNode } from "../reports/territory-nodes";
import { parseUserTerritoryParts } from "../work-slots/work-slots.query";
import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.territory";
import {
  inferCityTerritoryFromCode,
  isLikelyRegionStored,
  regionFilterNormKeys
} from "./mobile-territory-references";
import {
  lalakuExpandRegionFilterTokens,
  normKeyTerritoryMatch
} from "../../../shared/territory-lalaku-seed";

export type MobileAgentCityDto = {
  value: string;
  label: string;
  zone: string | null;
  region: string | null;
};

type CityMeta = { value: string; zone: string | null; region: string | null };

type TerritoryPath = { zone: string | null; region: string | null; city: string | null; depth: number };

function normTerritoryKey(s: string): string {
  return s.trim().toUpperCase().replace(/[\s\-_]+/g, " ");
}

function cityDisplayLabel(stored: string, hints: Record<string, CityTerritoryHintDto>): string {
  const t = stored.trim();
  const hint = hints[t] ?? hints[t.toUpperCase()];
  if (hint?.city_label?.trim()) return hint.city_label.trim();
  const parts = t.split("_").filter(Boolean);
  if (parts.length >= 2 && /^[A-Z0-9]{2,}$/i.test(parts[0]!)) {
    const tail = parts.slice(1).join(" ");
    if (tail) {
      return tail
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return t.replace(/_/g, " ");
}

function addCity(
  map: Map<string, CityMeta>,
  value: string,
  zone: string | null,
  region: string | null
) {
  const v = value.trim();
  if (!v) return;
  const existing = map.get(v);
  if (!existing) {
    map.set(v, { value: v, zone: zone?.trim() || null, region: region?.trim() || null });
    return;
  }
  if (!existing.zone && zone?.trim()) existing.zone = zone.trim();
  if (!existing.region && region?.trim()) existing.region = region.trim();
}

function hintForStored(
  stored: string,
  hints: Record<string, CityTerritoryHintDto>
): CityTerritoryHintDto | undefined {
  return hints[stored] ?? hints[stored.toUpperCase()];
}

function findTerritoryPathInTree(
  nodes: TerritoryNode[],
  code: string | null,
  name: string | null
): TerritoryPath | null {
  const codeKey = code?.trim() ? normTerritoryKey(code) : "";
  const nameKey = name?.trim() ? normTerritoryKey(name) : "";
  if (!codeKey && !nameKey) return null;

  let found: TerritoryPath | null = null;

  const walk = (list: TerritoryNode[], depth: number, path: string[]) => {
    if (found) return;
    for (const n of list) {
      if (n.active === false) continue;
      const nodeName = n.name.trim();
      if (!nodeName) continue;
      const nextPath = [...path, nodeName];
      const nodeCodeGuess = nodeName.toUpperCase().replace(/[\s\-]+/g, "_").slice(0, 20);
      const matches =
        (codeKey && (normTerritoryKey(nodeCodeGuess) === codeKey || normTerritoryKey(nodeName) === codeKey)) ||
        (nameKey && normTerritoryKey(nodeName) === nameKey);
      if (matches) {
        found = {
          zone: nextPath[0] ?? null,
          region: depth >= 1 ? (nextPath[1] ?? null) : null,
          city: depth >= 2 ? nodeName : null,
          depth
        };
        return;
      }
      if (n.children?.length) walk(n.children, depth + 1, nextPath);
    }
  };

  walk(nodes, 0, []);
  return found;
}

function citiesMatchingRegion(
  zone: string | null,
  region: string | null,
  allTenantCities: string[],
  hints: Record<string, CityTerritoryHintDto>
): string[] {
  if (!region?.trim()) return [];
  const regionKeys = regionFilterNormKeys(region);
  const zoneNorm = zone?.trim() ? normKeyTerritoryMatch(zone) : null;
  const out: string[] = [];
  for (const city of allTenantCities) {
    if (isLikelyRegionStored(city)) continue;
    const hint = hintForStored(city, hints);
    const inferred = inferCityTerritoryFromCode(city);
    const cityRegion =
      hint?.region_stored ?? hint?.region_label ?? inferred?.region ?? null;
    if (!cityRegion || !regionKeys.has(normKeyTerritoryMatch(cityRegion))) continue;
    if (zoneNorm) {
      const cityZone = hint?.zone_stored ?? hint?.zone_label ?? inferred?.zone ?? null;
      if (cityZone && normKeyTerritoryMatch(cityZone) !== zoneNorm) continue;
    }
    out.push(city);
  }
  return out;
}

function expandTerritoryPathToCities(
  map: Map<string, CityMeta>,
  path: TerritoryPath,
  citiesByZoneRegion: Record<string, string[]>,
  childCityNames: string[],
  allTenantCities: string[],
  hints: Record<string, CityTerritoryHintDto>
) {
  const zone = path.zone?.trim() || null;
  const region = path.region?.trim() || null;

  if (path.depth >= 2 && path.city) {
    if (!isLikelyRegionStored(path.city)) addCity(map, path.city, zone, region);
    return;
  }

  if (path.depth === 1 && region) {
    const key = zone ? `${zone}|||${region}` : `|||${region}`;
    const fromCascade = (citiesByZoneRegion[key] ?? []).filter((c) => !isLikelyRegionStored(c));
    if (fromCascade.length > 0) {
      for (const c of fromCascade) addCity(map, c, zone, region);
      return;
    }
    const fromChildren = childCityNames.filter((c) => !isLikelyRegionStored(c));
    if (fromChildren.length > 0) {
      for (const c of fromChildren) addCity(map, c, zone, region);
      return;
    }
    const fromCatalog = citiesMatchingRegion(zone, region, allTenantCities, hints);
    for (const c of fromCatalog) addCity(map, c, zone, region);
    return;
  }

  if (path.depth === 0 && zone) {
    for (const [key, cities] of Object.entries(citiesByZoneRegion)) {
      if (!key.startsWith(`${zone}|||`)) continue;
      const reg = key.split("|||")[1] ?? null;
      for (const c of cities) {
        if (isLikelyRegionStored(c)) continue;
        addCity(map, c, zone, reg);
      }
    }
  }
}

function collectChildCityNames(node: TerritoryNode | undefined): string[] {
  if (!node?.children?.length) return [];
  const out: string[] = [];
  const walk = (list: TerritoryNode[], depth: number) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = n.name.trim();
      if (!name) continue;
      if (depth === 0) out.push(name);
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(node.children, 0);
  return out;
}

/**
 * Agent profilidagi hududlar (Доступ → Прикрепить территории) va ish o‘rni bo‘yicha shaharlar.
 */
async function addClientCitiesInRegion(
  map: Map<string, CityMeta>,
  tenantId: number,
  zone: string | null,
  region: string | null,
  hints: Record<string, CityTerritoryHintDto>
) {
  if (!region?.trim()) return;
  const dbRegionValues = lalakuExpandRegionFilterTokens(region);
  const rows = await prisma.client.findMany({
    where: {
      tenant_id: tenantId,
      merged_into_client_id: null,
      city: { not: null },
      region: { in: dbRegionValues },
      ...(zone?.trim() ? { zone: zone.trim() } : {})
    },
    select: { city: true, zone: true, region: true }
  });
  for (const row of rows) {
    const city = row.city?.trim();
    if (!city || isLikelyRegionStored(city)) continue;
    let z = row.zone?.trim() || zone;
    let r = row.region?.trim() || region;
    const hint = hintForStored(city, hints);
    if (hint) {
      z = z ?? hint.zone_stored ?? hint.zone_label ?? null;
      r = r ?? hint.region_stored ?? hint.region_label ?? null;
    }
    if (!z || !r) {
      const inferred = inferCityTerritoryFromCode(city);
      if (inferred) {
        z = z ?? inferred.zone;
        r = r ?? inferred.region;
      }
    }
    addCity(map, city, z, r);
  }
}

type AssignedRegion = { zone: string | null; region: string };

function rememberAssignedRegion(
  list: AssignedRegion[],
  zone: string | null,
  region: string | null
) {
  const r = region?.trim();
  if (!r) return;
  const z = zone?.trim() || null;
  if (list.some((x) => x.region === r && x.zone === z)) return;
  list.push({ zone: z, region: r });
}

export async function getMobileAgentAssignedCities(
  tenantId: number,
  agentUserId: number,
  hints: Record<string, CityTerritoryHintDto>,
  opts: {
    territoryNodes: TerritoryNode[];
    citiesByZoneRegion: Record<string, string[]>;
    allTenantCities: string[];
  }
): Promise<MobileAgentCityDto[]> {
  const map = new Map<string, CityMeta>();
  const nodes = opts.territoryNodes;
  const allTenantCities = opts.allTenantCities ?? [];
  const assignedRegions: AssignedRegion[] = [];

  const user = await prisma.user.findFirst({
    where: { id: agentUserId, tenant_id: tenantId, is_active: true },
    select: { territory: true }
  });
  if (user?.territory) {
    const parts = parseUserTerritoryParts(user.territory);
    if (parts.city) {
      if (!isLikelyRegionStored(parts.city)) {
        addCity(map, parts.city, parts.zone, parts.oblast);
      }
    } else if (parts.oblast) {
      rememberAssignedRegion(assignedRegions, parts.zone, parts.oblast);
      expandTerritoryPathToCities(
        map,
        { zone: parts.zone, region: parts.oblast, city: null, depth: 1 },
        opts.citiesByZoneRegion,
        [],
        allTenantCities,
        hints
      );
    } else if (parts.zone) {
      expandTerritoryPathToCities(
        map,
        { zone: parts.zone, region: null, city: null, depth: 0 },
        opts.citiesByZoneRegion,
        [],
        allTenantCities,
        hints
      );
    }
  }

  const territoryLinks = await prisma.territoryUserLink.findMany({
    where: {
      user_id: agentUserId,
      territory: { tenant_id: tenantId, deleted_at: null, is_active: true }
    },
    select: { territory: { select: { code: true, name: true } } }
  });

  for (const link of territoryLinks) {
    const code = link.territory.code?.trim() || null;
    const name = link.territory.name?.trim() || null;
    const path = findTerritoryPathInTree(nodes, code, name);
    if (path) {
      let matchedNode: TerritoryNode | undefined;
      const findNode = (list: TerritoryNode[]) => {
        for (const n of list) {
          if (n.active === false) continue;
          const nodeName = n.name.trim();
          const nodeCodeGuess = nodeName.toUpperCase().replace(/[\s\-]+/g, "_").slice(0, 20);
          const isMatch =
            (code && (normTerritoryKey(code) === normTerritoryKey(nodeCodeGuess) ||
              normTerritoryKey(code) === normTerritoryKey(nodeName))) ||
            (name && normTerritoryKey(name) === normTerritoryKey(nodeName));
          if (isMatch) {
            matchedNode = n;
            return;
          }
          if (n.children?.length) findNode(n.children);
          if (matchedNode) return;
        }
      };
      findNode(nodes);
      if (path.depth === 1 && path.region) {
        rememberAssignedRegion(assignedRegions, path.zone, path.region);
      }
      expandTerritoryPathToCities(
        map,
        path,
        opts.citiesByZoneRegion,
        collectChildCityNames(matchedNode),
        allTenantCities,
        hints
      );
      continue;
    }
    const stored = code ?? name ?? "";
    if (isLikelyRegionStored(stored)) {
      const hint = hintForStored(stored, hints);
      const inferred = inferCityTerritoryFromCode(stored);
      const regionName = name ?? hint?.region_label ?? inferred?.region ?? null;
      const zoneName = hint?.zone_stored ?? hint?.zone_label ?? inferred?.zone ?? null;
      if (regionName) {
        rememberAssignedRegion(assignedRegions, zoneName, regionName);
        expandTerritoryPathToCities(
          map,
          { zone: zoneName, region: regionName, city: null, depth: 1 },
          opts.citiesByZoneRegion,
          [],
          allTenantCities,
          hints
        );
      }
      continue;
    }
    const hint = hintForStored(stored, hints);
    const inferred = inferCityTerritoryFromCode(stored);
    addCity(
      map,
      stored,
      hint?.zone_stored ?? hint?.zone_label ?? inferred?.zone ?? null,
      hint?.region_stored ?? hint?.region_label ?? inferred?.region ?? name
    );
  }

  const hasTerritoryScope = territoryLinks.length > 0 || Boolean(user?.territory?.trim());

  if (hasTerritoryScope) {
    for (const ar of assignedRegions) {
      await addClientCitiesInRegion(map, tenantId, ar.zone, ar.region, hints);
    }
  }

  if (!hasTerritoryScope) {
    const clientRows = await prisma.client.findMany({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        city: { not: null },
        OR: [
          { agent_id: agentUserId },
          { agent_assignments: { some: { agent_id: agentUserId } } }
        ]
      },
      select: { city: true, zone: true, region: true }
    });
    for (const row of clientRows) {
      const city = row.city?.trim();
      if (!city || isLikelyRegionStored(city)) continue;
      let zone = row.zone?.trim() || null;
      let region = row.region?.trim() || null;
      const hint = hintForStored(city, hints);
      if (hint) {
        zone = zone ?? hint.zone_stored ?? hint.zone_label ?? null;
        region = region ?? hint.region_stored ?? hint.region_label ?? null;
      }
      if (!zone || !region) {
        const inferred = inferCityTerritoryFromCode(city);
        if (inferred) {
          zone = zone ?? inferred.zone;
          region = region ?? inferred.region;
        }
      }
      addCity(map, city, zone, region);
    }
  }

  const raw = [...map.values()]
    .filter((c) => !isLikelyRegionStored(c.value))
    .map((c) => ({
      value: c.value,
      label: cityDisplayLabel(c.value, hints),
      zone: c.zone,
      region: c.region
    }));

  return dedupeAgentCitiesByLabel(raw);
}

/** Bir xil label (masalan «ANDIJON TUMANI») — kodli qiymat ustun (`AD_TUMANI`). */
function dedupeAgentCitiesByLabel(items: MobileAgentCityDto[]): MobileAgentCityDto[] {
  const byKey = new Map<string, MobileAgentCityDto>();
  for (const item of items) {
    const labelKey = normKeyTerritoryMatch(item.label);
    const regionKey = normKeyTerritoryMatch(item.region ?? "");
    const key = `${regionKey}|||${labelKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    if (preferCityStoredValue(item.value, existing.value)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

function preferCityStoredValue(candidate: string, incumbent: string): boolean {
  const cCode = /^[A-Z0-9]{2,}_[A-Z0-9_]+$/i.test(candidate.trim());
  const iCode = /^[A-Z0-9]{2,}_[A-Z0-9_]+$/i.test(incumbent.trim());
  if (cCode && !iCode) return true;
  if (!cCode && iCode) return false;
  return candidate.trim().length < incumbent.trim().length;
}
