import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import { cityStoredCodeToDisplayLabel } from "@/lib/city-territory-hint";
import {
  dedupeRefSelectOptionsByTerritoryDisplayName,
  mergeRefSelectOptions,
  type RefSelectOption
} from "@/lib/ref-select-options";
import { collectActiveNamesAtDepth, type TerritoryNode } from "@/lib/territory-tree";
import { normKeyTerritoryMatch } from "@shared/territory-lalaku-seed";

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

function territoryNamesEqual(a: string, b: string): boolean {
  const left = trimText(a);
  const right = trimText(b);
  if (!left || !right) return false;
  return normKeyTerritoryMatch(left) === normKeyTerritoryMatch(right);
}

function allowedNormKeys(names: string[]): Set<string> {
  const s = new Set<string>();
  for (const n of names) {
    const t = trimText(n);
    if (t) s.add(normKeyTerritoryMatch(t));
  }
  return s;
}

/** Refs/live qiymati daraxt dagi ruxsat etilgan nomlar ostidami (value yoki label orqali). */
function valueBelongsToAllowedNames(
  value: string,
  allowed: Set<string>,
  options: Array<{ value: string; label: string }> | undefined
): boolean {
  const v = trimText(value);
  if (!v || allowed.size === 0) return false;
  if (allowed.has(normKeyTerritoryMatch(v))) return true;
  for (const o of options ?? []) {
    const ov = trimText(o.value);
    const ol = trimText(o.label) || ov;
    if (!ov) continue;
    if (ov === v || territoryNamesEqual(ov, v) || territoryNamesEqual(ol, v)) {
      if (allowed.has(normKeyTerritoryMatch(ov)) || allowed.has(normKeyTerritoryMatch(ol))) {
        return true;
      }
    }
  }
  return false;
}

/** Parent tanlanganda: daraxt bolalari asosiy; refs/live faqat shu parent ostidagilar.
 * Parent yo‘q yoki daraxt umuman yo‘q bo‘lsa — to‘liq birlashma.
 */
function cascadeChildFallback(
  parentSelected: boolean,
  hasTerritoryTree: boolean,
  treeChildren: string[],
  refsValues: string[] | undefined,
  liveValues: string[] | undefined,
  options: Array<{ value: string; label: string }> | undefined
): string[] {
  if (!parentSelected || !hasTerritoryTree) {
    return uniqSorted([...(refsValues ?? []), ...(liveValues ?? []), ...treeChildren]);
  }
  const allowed = allowedNormKeys(treeChildren);
  const extras = [...(refsValues ?? []), ...(liveValues ?? [])].filter((v) =>
    valueBelongsToAllowedNames(v, allowed, options)
  );
  return uniqSorted([...treeChildren, ...extras]);
}

/** Parent tanlanganda `region_options` / `city_options` ham filtrlansin (aks holda dilution). */
function filterRefOptionsForCascade(
  parentSelected: boolean,
  hasTerritoryTree: boolean,
  options: Array<{ value: string; label: string }> | undefined,
  treeChildren: string[],
  currentValue: string
): RefSelectOption[] | undefined {
  if (!options?.length) return options as RefSelectOption[] | undefined;
  if (!parentSelected || !hasTerritoryTree) return options as RefSelectOption[] | undefined;
  const allowed = allowedNormKeys(treeChildren);
  const cur = trimText(currentValue);
  const out: RefSelectOption[] = [];
  for (const o of options) {
    const v = trimText(o.value);
    if (!v) continue;
    if (cur && v === cur) {
      out.push({ value: v, label: trimText(o.label) || v });
      continue;
    }
    if (valueBelongsToAllowedNames(v, allowed, options)) {
      out.push({ value: v, label: trimText(o.label) || v });
    }
  }
  return out;
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
        if (!wantZone || territoryNamesEqual(zoneName, wantZone)) regions.add(name);
      }
      if (depth === 2) {
        const zoneName = nextPath[0] ?? "";
        const regionName = nextPath[1] ?? "";
        const zoneOk = !wantZone || territoryNamesEqual(zoneName, wantZone);
        const regionOk = !wantRegion || territoryNamesEqual(regionName, wantRegion);
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
 * Zona tanlanganda region/city faqat shu zona ostidagi daraxt + mos refs/live.
 */
export function buildZoneRegionCityCascadeOptions(
  refs: ClientRefsTerritoryBundle | undefined,
  live: ClientBalanceTerritoryOptions | undefined,
  territoryNodes: TerritoryNode[] | undefined,
  current: { zone: string; region: string; city: string }
): { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] } {
  const tree = collectTreeZoneRegionCity(territoryNodes, current.zone, current.region);
  const wantZone = trimText(current.zone);
  const wantRegion = trimText(current.region);
  const hasTerritoryTree = (territoryNodes?.length ?? 0) > 0;

  const zones = toSelectOptions(
    uniqSorted([...(refs?.zones ?? []), ...(live?.zones ?? []), ...tree.zones]),
    current.zone
  );

  const regionOpts = filterRefOptionsForCascade(
    Boolean(wantZone),
    hasTerritoryTree,
    refs?.region_options as RefSelectOption[] | undefined,
    tree.regions,
    current.region
  );
  const regionFallback = cascadeChildFallback(
    Boolean(wantZone),
    hasTerritoryTree,
    tree.regions,
    refs?.regions,
    live?.regions,
    refs?.region_options as RefSelectOption[] | undefined
  );
  const regions = dedupeRefSelectOptionsByTerritoryDisplayName(
    mergeRefSelectOptions(current.region, regionOpts, regionFallback)
  );

  const cityOpts = filterRefOptionsForCascade(
    Boolean(wantZone || wantRegion),
    hasTerritoryTree,
    refs?.city_options as RefSelectOption[] | undefined,
    tree.cities,
    current.city
  );
  const cityFallback = cascadeChildFallback(
    Boolean(wantZone || wantRegion),
    hasTerritoryTree,
    tree.cities,
    refs?.cities,
    live?.cities,
    refs?.city_options as RefSelectOption[] | undefined
  );
  const cities = dedupeRefSelectOptionsByTerritoryDisplayName(
    mergeRefSelectOptions(current.city, cityOpts, cityFallback)
  ).map((o) => ({
    value: o.value,
    label: cityStoredCodeToDisplayLabel(o.value, o.label)
  }));

  return { zones, regions, cities };
}
