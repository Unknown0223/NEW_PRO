type TerritoryNode = {
  name?: string;
  active?: boolean;
  children?: TerritoryNode[];
};

export type TerritoryFallback = {
  territory1: string[];
  territory2: string[];
  territory3: string[];
  territory2By1: Record<string, string[]>;
  territory3By2: Record<string, string[]>;
};

function parseTerritoryNodeList(v: unknown): TerritoryNode[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    .map((x) => ({
      name: typeof x.name === "string" ? x.name : undefined,
      active: typeof x.active === "boolean" ? x.active : undefined,
      children: parseTerritoryNodeList(x.children)
    }));
}

export function territoryFromNodes(nodes: TerritoryNode[]): TerritoryFallback {
  const t1 = new Set<string>();
  const t2 = new Set<string>();
  const t3 = new Set<string>();
  const t2By1 = new Map<string, Set<string>>();
  const t3By2 = new Map<string, Set<string>>();
  for (const zoneNode of nodes) {
    if (zoneNode.active === false) continue;
    const zone = String(zoneNode.name ?? "").trim();
    if (!zone) continue;
    t1.add(zone);
    const z2 = t2By1.get(zone) ?? new Set<string>();
    for (const regionNode of zoneNode.children ?? []) {
      if (regionNode.active === false) continue;
      const region = String(regionNode.name ?? "").trim();
      if (!region) continue;
      t2.add(region);
      z2.add(region);
      const r3 = t3By2.get(region) ?? new Set<string>();
      for (const cityNode of regionNode.children ?? []) {
        if (cityNode.active === false) continue;
        const city = String(cityNode.name ?? "").trim();
        if (!city) continue;
        t3.add(city);
        r3.add(city);
      }
      t3By2.set(region, r3);
    }
    t2By1.set(zone, z2);
  }
  return {
    territory1: [...t1],
    territory2: [...t2],
    territory3: [...t3],
    territory2By1: Object.fromEntries([...t2By1.entries()].map(([k, v]) => [k, [...v]])),
    territory3By2: Object.fromEntries([...t3By2.entries()].map(([k, v]) => [k, [...v]]))
  };
}

export function territoryFallbackFromProfile(profile: Record<string, unknown> | undefined): TerritoryFallback {
  const refs = (profile?.references ?? {}) as Record<string, unknown>;
  return territoryFromNodes(parseTerritoryNodeList(refs.territory_nodes));
}
