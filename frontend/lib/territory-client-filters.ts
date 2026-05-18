import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import { cityStoredCodeToDisplayLabel } from "@/lib/city-territory-hint";
import {
  dedupeRefSelectOptionsByTerritoryDisplayName,
  mergeRefSelectOptions,
  type RefSelectOption
} from "@/lib/ref-select-options";
import { collectActiveNamesAtDepth, type TerritoryNode } from "@/lib/territory-tree";

/** Mijoz kartochkasi / to‘lov filtri: maydonlar (махалля filtri olib tashlangan). */
export type ClientTerritoryFilterField = "zone" | "region" | "city" | "district";

const FIELD_ORDER: ClientTerritoryFilterField[] = ["zone", "region", "city", "district"];

/** Hudud daraxtida qatlam (ildiz = 0) — `zone` bo‘sh bo‘lsa ham tanlov to‘ldiriladi. */
const TREE_DEPTH: Record<ClientTerritoryFilterField, number> = {
  zone: 0,
  region: 1,
  city: 2,
  district: 3
};

export type TerritoryFilterLevelSpec = {
  field: ClientTerritoryFilterField;
  label: string;
  visIndex: 1 | 2 | 3 | 4 | 5;
};

/** GET /clients/references dan kerakli qismlar */
export type ClientRefsTerritoryBundle = {
  regions?: string[];
  cities?: string[];
  districts?: string[];
  zones?: string[];
  region_options?: { value: string; label: string }[];
  city_options?: { value: string; label: string }[];
};

function mergeDistinct(base: string[] | undefined, ...extras: string[][]): string[] {
  const s = new Set<string>();
  for (const x of base ?? []) {
    const t = String(x).trim();
    if (t) s.add(t);
  }
  for (const arr of extras) {
    for (const x of arr) {
      const t = String(x).trim();
      if (t) s.add(t);
    }
  }
  return [...s];
}

function treeNamesAtField(nodes: TerritoryNode[] | undefined, field: ClientTerritoryFilterField): string[] {
  const d = TREE_DEPTH[field];
  return collectActiveNamesAtDepth(nodes ?? [], d);
}

function liveDistinct(field: ClientTerritoryFilterField, live: ClientBalanceTerritoryOptions | undefined): string[] {
  if (!live) return [];
  switch (field) {
    case "zone":
      return live.zones ?? [];
    case "region":
      return live.regions ?? [];
    case "city":
      return live.cities ?? [];
    case "district":
      return live.districts ?? [];
    default:
      return [];
  }
}

/**
 * `references.territory_levels` bo‘yicha sarlavha va maydon.
 * Sozlama bo‘lmasa — Зона / Область / Город (`zone` → `region` → `city`).
 */
export function buildClientTerritoryFilterLevels(
  territoryLevelNames: string[] | undefined | null
): TerritoryFilterLevelSpec[] {
  const raw = (territoryLevelNames ?? []).map((s) => String(s).trim()).filter(Boolean);
  /** Sozlama bo‘lmasa: daraxt chuqurligi bilan bir xil — Зона → Область → Город (`FIELD_ORDER`). */
  if (raw.length === 0) {
    return [
      { field: "zone", label: "Зона", visIndex: 1 },
      { field: "region", label: "Область", visIndex: 2 },
      { field: "city", label: "Город", visIndex: 3 }
    ];
  }
  /** Махалля filtri yo‘q — tenantda 5 ta nom bo‘lsa ham faqat 4 daraja (zona…tuman). */
  const n = Math.min(raw.length, FIELD_ORDER.length);
  return FIELD_ORDER.slice(0, n).map((field, i) => ({
    field,
    label: raw[i] || `Уровень ${i + 1}`,
    visIndex: (i + 1) as 1 | 2 | 3 | 4 | 5
  }));
}

/**
 * To‘lovlar filtri: kod o‘rniga `city_options` / `region_options` yorliqlari + daraxt + mijozlar distinct.
 */
export function buildPaymentTerritorySelectOptions(
  field: ClientTerritoryFilterField,
  refs: ClientRefsTerritoryBundle | undefined,
  live: ClientBalanceTerritoryOptions | undefined,
  territoryNodes: TerritoryNode[] | undefined,
  currentValue: string
): RefSelectOption[] {
  const tree = treeNamesAtField(territoryNodes, field);
  const liveVals = liveDistinct(field, live);

  let opts: RefSelectOption[];
  switch (field) {
    case "region": {
      const fallback = mergeDistinct(refs?.regions, tree, liveVals);
      opts = mergeRefSelectOptions(currentValue, refs?.region_options, fallback);
      return dedupeRefSelectOptionsByTerritoryDisplayName(opts);
    }
    case "city": {
      const fallback = mergeDistinct(refs?.cities, tree, liveVals);
      opts = mergeRefSelectOptions(currentValue, refs?.city_options, fallback);
      return dedupeRefSelectOptionsByTerritoryDisplayName(opts);
    }
    case "district": {
      const fallback = mergeDistinct(refs?.districts, tree, liveVals);
      opts = mergeRefSelectOptions(currentValue, undefined, fallback);
      return dedupeRefSelectOptionsByTerritoryDisplayName(opts);
    }
    case "zone": {
      const fallback = mergeDistinct(refs?.zones, tree, liveVals);
      opts = mergeRefSelectOptions(currentValue, undefined, fallback);
      return dedupeRefSelectOptionsByTerritoryDisplayName(opts);
    }
    default:
      return [];
  }
}

function trimText(v: string | null | undefined): string {
  return String(v ?? "").trim();
}

function uniqSorted(values: string[]): string[] {
  const s = new Set<string>();
  for (const v of values) {
    const t = trimText(v);
    if (t) s.add(t);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
}

function collectTreeZoneRegionCity(
  nodes: TerritoryNode[] | undefined,
  selectedZone: string,
  selectedRegion: string
): { zones: string[]; regions: string[]; cities: string[] } {
  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();

  const wantZone = trimText(selectedZone);
  const wantRegion = trimText(selectedRegion);

  const walk = (list: TerritoryNode[], depth: number, path: string[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = trimText(n.name);
      if (!name) continue;
      const nextPath = [...path, name];
      if (depth === 0) {
        zones.add(name);
      }
      if (depth === 1) {
        const zoneName = nextPath[0] ?? "";
        if (!wantZone || zoneName === wantZone) regions.add(name);
      }
      if (depth === 2) {
        const zoneName = nextPath[0] ?? "";
        const regionName = nextPath[1] ?? "";
        const zoneOk = !wantZone || zoneName === wantZone;
        const regionOk = !wantRegion || regionName === wantRegion;
        if (zoneOk && regionOk) cities.add(name);
      }
      if (n.children?.length) walk(n.children, depth + 1, nextPath);
    }
  };

  walk(nodes ?? [], 0, []);
  return {
    zones: Array.from(zones).sort((a, b) => a.localeCompare(b, "ru")),
    regions: Array.from(regions).sort((a, b) => a.localeCompare(b, "ru")),
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, "ru"))
  };
}

function toSelectOptions(values: string[], currentValue: string): RefSelectOption[] {
  const merged = uniqSorted([currentValue, ...values]);
  return merged.map((v) => ({ value: v, label: v }));
}

/**
 * Kaskad tanlash: Зона -> Область -> Город.
 * Hammasi nom bo‘yicha (kod emas).
 */
export function buildZoneRegionCityCascadeOptions(
  refs: ClientRefsTerritoryBundle | undefined,
  live: ClientBalanceTerritoryOptions | undefined,
  territoryNodes: TerritoryNode[] | undefined,
  current: { zone: string; region: string; city: string }
): { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] } {
  const tree = collectTreeZoneRegionCity(territoryNodes, current.zone, current.region);

  const zones = toSelectOptions(
    uniqSorted([...(refs?.zones ?? []), ...(live?.zones ?? []), ...tree.zones]),
    current.zone
  );

  const regionFallback = uniqSorted([
    ...(refs?.regions ?? []),
    ...(live?.regions ?? []),
    ...tree.regions
  ]);
  const regions = dedupeRefSelectOptionsByTerritoryDisplayName(
    mergeRefSelectOptions(current.region, refs?.region_options as RefSelectOption[] | undefined, regionFallback)
  );

  const cityFallback = uniqSorted([...(refs?.cities ?? []), ...(live?.cities ?? []), ...tree.cities]);
  const cities = dedupeRefSelectOptionsByTerritoryDisplayName(
    mergeRefSelectOptions(current.city, refs?.city_options as RefSelectOption[] | undefined, cityFallback)
  ).map((o) => ({
    value: o.value,
    label: cityStoredCodeToDisplayLabel(o.value, o.label)
  }));

  return { zones, regions, cities };
}
