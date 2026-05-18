/** Tenant `references.territory_nodes` + mijozlar `zone` / `region` / `city` — filtr opsiyalari */

export type TerritoryNode = {
  name: string;
  active?: boolean;
  children?: TerritoryNode[];
};

export function parseTerritoryNodes(value: unknown): TerritoryNode[] {
  if (!Array.isArray(value)) return [];
  const out: TerritoryNode[] = [];
  for (const raw of value) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const active = typeof row.active === "boolean" ? row.active : true;
    const children = parseTerritoryNodes(row.children);
    out.push({ name, active, children });
  }
  return out;
}

export function buildTerritoryIndexFromNodes(nodes: TerritoryNode[]) {
  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();
  const regionsByZone = new Map<string, Set<string>>();
  const citiesByRegion = new Map<string, Set<string>>();

  for (const zoneNode of nodes) {
    if (zoneNode.active === false) continue;
    const zone = zoneNode.name.trim();
    if (!zone) continue;
    zones.add(zone);
    const zoneRegions = regionsByZone.get(zone) ?? new Set<string>();

    for (const regionNode of zoneNode.children ?? []) {
      if (regionNode.active === false) continue;
      const region = regionNode.name.trim();
      if (!region) continue;
      regions.add(region);
      zoneRegions.add(region);
      const regionCities = citiesByRegion.get(region) ?? new Set<string>();

      for (const cityNode of regionNode.children ?? []) {
        if (cityNode.active === false) continue;
        const city = cityNode.name.trim();
        if (!city) continue;
        cities.add(city);
        regionCities.add(city);
      }
      citiesByRegion.set(region, regionCities);
    }
    regionsByZone.set(zone, zoneRegions);
  }

  return {
    territory_1: [...zones].sort((a, b) => a.localeCompare(b, "ru")),
    territory_2: [...regions].sort((a, b) => a.localeCompare(b, "ru")),
    territory_3: [...cities].sort((a, b) => a.localeCompare(b, "ru")),
    territory_2_by_1: Object.fromEntries(
      [...regionsByZone.entries()].map(([zone, set]) => [zone, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
    ) as Record<string, string[]>,
    territory_3_by_2: Object.fromEntries(
      [...citiesByRegion.entries()].map(([region, set]) => [region, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
    ) as Record<string, string[]>
  };
}

export type TerritoryRow = { t1: string | null; t2: string | null; t3: string | null };

/** Mijozlar jadvalidan kelgan qatorlar bo‘yicha zona → viloyat → shahar xaritalari */
export function buildTerritoryMapsFromClientRows(rows: TerritoryRow[]) {
  const zoneRegionMap = new Map<string, Set<string>>();
  const zoneRegionCityMap = new Map<string, Set<string>>();
  for (const row of rows) {
    const z = (row.t1 ?? "").trim();
    const r = (row.t2 ?? "").trim();
    const c = (row.t3 ?? "").trim();
    if (!z) continue;
    if (!zoneRegionMap.has(z)) zoneRegionMap.set(z, new Set<string>());
    if (r) zoneRegionMap.get(z)!.add(r);
    if (r) {
      const zr = `${z}|||${r}`;
      if (!zoneRegionCityMap.has(zr)) zoneRegionCityMap.set(zr, new Set<string>());
      if (c) zoneRegionCityMap.get(zr)!.add(c);
    }
  }
  return { zoneRegionMap, zoneRegionCityMap };
}

export function mergeTerritoryFilterOptions(
  refs: Record<string, unknown>,
  territoryRows: TerritoryRow[]
) {
  const t1 = [...new Set(territoryRows.map((x) => (x.t1 ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
  const t2 = [...new Set(territoryRows.map((x) => (x.t2 ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
  const t3 = [...new Set(territoryRows.map((x) => (x.t3 ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  const territoryNodes = parseTerritoryNodes(refs.territory_nodes);
  const territoryFromSettings = buildTerritoryIndexFromNodes(territoryNodes);

  const { zoneRegionMap, zoneRegionCityMap } = buildTerritoryMapsFromClientRows(territoryRows);

  const territory2By1FromData = new Map<string, Set<string>>();
  const territory3By2FromData = new Map<string, Set<string>>();
  for (const row of territoryRows) {
    const zone = (row.t1 ?? "").trim();
    const region = (row.t2 ?? "").trim();
    const city = (row.t3 ?? "").trim();
    if (zone && region) {
      const set = territory2By1FromData.get(zone) ?? new Set<string>();
      set.add(region);
      territory2By1FromData.set(zone, set);
    }
    if (region && city) {
      const set = territory3By2FromData.get(region) ?? new Set<string>();
      set.add(city);
      territory3By2FromData.set(region, set);
    }
  }

  const territory_2_by_1 =
    Object.keys(territoryFromSettings.territory_2_by_1).length > 0
      ? territoryFromSettings.territory_2_by_1
      : (Object.fromEntries(
          [...territory2By1FromData.entries()].map(([zone, set]) => [
            zone,
            [...set].sort((a, b) => a.localeCompare(b, "ru"))
          ])
        ) as Record<string, string[]>);

  const territory_3_by_2 =
    Object.keys(territoryFromSettings.territory_3_by_2).length > 0
      ? territoryFromSettings.territory_3_by_2
      : (Object.fromEntries(
          [...territory3By2FromData.entries()].map(([region, set]) => [
            region,
            [...set].sort((a, b) => a.localeCompare(b, "ru"))
          ])
        ) as Record<string, string[]>);

  const territory_tree = territoryRows.map((x) => ({
    zone: (x.t1 ?? "").trim(),
    region: (x.t2 ?? "").trim(),
    city: (x.t3 ?? "").trim()
  }));

  const regions_by_zone = Object.fromEntries(
    [...zoneRegionMap.entries()].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, "ru"))])
  ) as Record<string, string[]>;

  const cities_by_zone_region = Object.fromEntries(
    [...zoneRegionCityMap.entries()].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, "ru"))])
  ) as Record<string, string[]>;

  return {
    territory_1: territoryFromSettings.territory_1.length > 0 ? territoryFromSettings.territory_1 : t1,
    territory_2: territoryFromSettings.territory_2.length > 0 ? territoryFromSettings.territory_2 : t2,
    territory_3: territoryFromSettings.territory_3.length > 0 ? territoryFromSettings.territory_3 : t3,
    territory_2_by_1,
    territory_3_by_2,
    territory_tree,
    regions_by_zone,
    cities_by_zone_region
  };
}
