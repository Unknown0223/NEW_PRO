import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import {
  cityStoredCodeToDisplayLabel,
  pickCityTerritoryHint,
  type CityTerritoryHint
} from "@/lib/city-territory-hint";
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

/**
 * Bulk: tanlangan zona/oblast bo‘yicha barcha pastki darajalar.
 * Daraxt (istalgan chuqurlik) + city hints / options (refs.zones ≠ tree ildizi bo‘lganda).
 */
export function expandTerritoryDescendants(
  nodes: TerritoryNode[] | undefined,
  selectedZones: string[],
  selectedRegions: string[],
  extras?: {
    regionOptions?: RefSelectOption[];
    cityOptions?: RefSelectOption[];
    cityHints?: Record<string, CityTerritoryHint>;
  }
): { regions: string[]; cities: string[] } {
  const zones = uniqSorted(selectedZones);
  const regionsSel = uniqSorted(selectedRegions);
  const regionOptions = extras?.regionOptions ?? [];
  const cityOptions = extras?.cityOptions ?? [];
  const cityHints = extras?.cityHints;

  if (zones.length === 0 && regionsSel.length === 0) {
    return { regions: [], cities: [] };
  }

  const regions = new Set<string>();
  const cities = new Set<string>();

  const addFromNode = (node: TerritoryNode, asRegionRoot: boolean) => {
    for (const child of node.children ?? []) {
      if (child.active === false) continue;
      const childName = trimText(child.name);
      if (!childName) continue;
      if (asRegionRoot) {
        regions.add(childName);
        for (const grand of child.children ?? []) {
          if (grand.active === false) continue;
          const gn = trimText(grand.name);
          if (gn) cities.add(gn);
        }
      } else {
        cities.add(childName);
      }
    }
  };

  // 1) Daraxt: nom bo‘yicha istalgan chuqurlikda
  if (zones.length > 0 && (nodes?.length ?? 0) > 0) {
    for (const z of zones) {
      for (const node of findTerritoryNodesByName(nodes, z)) {
        addFromNode(node, true);
      }
    }
  }
  if (regionsSel.length > 0 && (nodes?.length ?? 0) > 0) {
    if (regionsSel.length > 0) {
      // Oblast aniq tanlangan — shaharlar shu tugunlardan
      const cityFromRegions = new Set<string>();
      for (const r of regionsSel) {
        for (const node of findTerritoryNodesByName(nodes, r)) {
          for (const child of node.children ?? []) {
            if (child.active === false) continue;
            const cn = trimText(child.name);
            if (cn) cityFromRegions.add(cn);
          }
        }
      }
      if (cityFromRegions.size > 0) {
        cities.clear();
        for (const c of cityFromRegions) cities.add(c);
      }
      for (const r of regionsSel) regions.add(r);
    }
  }

  // 2) Legacy depth-based (zona = ildiz) — qo‘shimcha
  if (zones.length > 0) {
    for (const z of zones) {
      const t = collectTreeZoneRegionCity(nodes, z, "");
      for (const r of t.regions) regions.add(r);
      for (const c of t.cities) cities.add(c);
    }
  }

  // 3) Hints: zona/oblast → shaharlar (daraxt bo‘sh yoki nomlar farq qilganda)
  if (cityHints && cityOptions.length > 0) {
    for (const opt of cityOptions) {
      const hint = pickCityTerritoryHint(cityHints, opt.value);
      if (!hint) continue;
      const zoneHit =
        zones.length > 0 &&
        zones.some(
          (z) =>
            (hint.zone_stored && territoryNamesEqual(hint.zone_stored, z)) ||
            (hint.zone_label && territoryNamesEqual(hint.zone_label, z))
        );
      const regionHit =
        regionsSel.length > 0 &&
        regionsSel.some(
          (r) =>
            (hint.region_stored && territoryNamesEqual(hint.region_stored, r)) ||
            (hint.region_label && territoryNamesEqual(hint.region_label, r))
        );
      const regionFromZone =
        zones.length > 0 &&
        regionsSel.length === 0 &&
        zoneHit &&
        Boolean(hint.region_stored || hint.region_label);

      if (regionsSel.length > 0) {
        if (regionHit) cities.add(opt.value);
      } else if (zoneHit) {
        cities.add(opt.value);
        const rn = trimText(hint.region_stored || hint.region_label || "");
        if (rn) regions.add(rn);
      } else if (regionFromZone) {
        cities.add(opt.value);
      }
    }
  }

  // 4) Region options: zona nomi bilan bog‘liq oblastlar (masalan Andijon → Andijon Viloyati)
  if (zones.length > 0 && regionOptions.length > 0 && regions.size === 0) {
    for (const z of zones) {
      const zk = normKeyTerritoryMatch(z);
      for (const o of regionOptions) {
        const lk = normKeyTerritoryMatch(o.label);
        const vk = normKeyTerritoryMatch(o.value);
        if (lk.includes(zk) || vk.includes(zk) || zk.includes(lk) || territoryNamesEqual(o.label, z)) {
          regions.add(trimText(o.value) || trimText(o.label));
        }
      }
    }
  }

  // Agar oblast tanlangan bo‘lsa — faqat shu oblast ostidagi shaharlarni qoldirish (hints)
  if (regionsSel.length > 0 && cityHints && cityOptions.length > 0) {
    const scoped = new Set<string>();
    for (const opt of cityOptions) {
      const hint = pickCityTerritoryHint(cityHints, opt.value);
      if (!hint) continue;
      const ok = regionsSel.some(
        (r) =>
          (hint.region_stored && territoryNamesEqual(hint.region_stored, r)) ||
          (hint.region_label && territoryNamesEqual(hint.region_label, r))
      );
      if (ok) scoped.add(opt.value);
    }
    // Tree cities already in `cities`; merge scoped
    for (const c of scoped) cities.add(c);
  }

  return {
    regions: Array.from(regions).sort((a, b) => a.localeCompare(b, "ru")),
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, "ru"))
  };
}

function findTerritoryNodesByName(
  nodes: TerritoryNode[] | undefined,
  want: string
): TerritoryNode[] {
  const target = trimText(want);
  if (!target) return [];
  const out: TerritoryNode[] = [];
  const walk = (list: TerritoryNode[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      if (territoryNamesEqual(n.name, target)) out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes ?? []);
  return out;
}

/** Daraxt nomlarini dropdown `value` lariga moslash (label/value / normKey). */
export function matchTerritoryNamesToOptionValues(
  names: string[],
  options: RefSelectOption[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = trimText(raw);
    if (!name) continue;
    const hit = options.find(
      (o) =>
        territoryNamesEqual(o.value, name) ||
        territoryNamesEqual(o.label, name)
    );
    const value = trimText(hit?.value ?? name);
    if (!value || seen.has(normKeyTerritoryMatch(value))) continue;
    seen.add(normKeyTerritoryMatch(value));
    out.push(value);
  }
  return out;
}

function toSelectOptions(values: string[], currentValue: string): RefSelectOption[] {
  const merged = uniqSorted([currentValue, ...values]);
  return merged.map((v) => ({ value: v, label: v }));
}

/**
 * Kaskad tanlash: Зона -> Область -> Город.
 * Zona tanlanganda region/city faqat shu zona ostidagi daraxt + mos refs/live.
 *
 * Agar `territory_nodes` bor bo‘lsa — **faqat daraxt** (refs.zones aralashmasin:
 * FV vs Andijon chalkashligi).
 */
export function buildZoneRegionCityCascadeOptions(
  refs: ClientRefsTerritoryBundle | undefined,
  live: ClientBalanceTerritoryOptions | undefined,
  territoryNodes: TerritoryNode[] | undefined,
  current: { zone: string; region: string; city: string }
): { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] } {
  const hasTerritoryTree = (territoryNodes?.length ?? 0) > 0;
  if (hasTerritoryTree) {
    return buildTerritoryTreeOnlyCascade(territoryNodes, {
      zones: current.zone ? [current.zone] : [],
      regions: current.region ? [current.region] : []
    });
  }

  const tree = collectTreeZoneRegionCity(territoryNodes, current.zone, current.region);
  const wantZone = trimText(current.zone);
  const wantRegion = trimText(current.region);

  const zones = toSelectOptions(
    uniqSorted([...(refs?.zones ?? []), ...(live?.zones ?? []), ...tree.zones]),
    current.zone
  );

  const regionOpts = filterRefOptionsForCascade(
    Boolean(wantZone),
    false,
    refs?.region_options as RefSelectOption[] | undefined,
    tree.regions,
    current.region
  );
  const regionFallback = cascadeChildFallback(
    Boolean(wantZone),
    false,
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
    false,
    refs?.city_options as RefSelectOption[] | undefined,
    tree.cities,
    current.city
  );
  const cityFallback = cascadeChildFallback(
    Boolean(wantZone || wantRegion),
    false,
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

/**
 * Faqat `territory_nodes`: depth0=zona, depth1=oblast, depth2=gorod.
 * Tanlangan zona/oblast bo‘yicha pastki ro‘yxatlar filtrlanadi.
 */
export function buildTerritoryTreeOnlyCascade(
  territoryNodes: TerritoryNode[] | undefined,
  selected: { zones: string[]; regions: string[] }
): { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] } {
  const zoneSel = uniqSorted(selected.zones);
  const regionSel = uniqSorted(selected.regions);

  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();

  const walk = (list: TerritoryNode[], depth: number, path: string[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = trimText(n.name);
      if (!name) continue;
      const nextPath = [...path, name];
      if (depth === 0) {
        zones.add(name);
      } else if (depth === 1) {
        const zoneName = nextPath[0] ?? "";
        if (zoneSel.length === 0 || zoneSel.some((z) => territoryNamesEqual(z, zoneName))) {
          regions.add(name);
        }
      } else if (depth === 2) {
        const zoneName = nextPath[0] ?? "";
        const regionName = nextPath[1] ?? "";
        const zoneOk =
          zoneSel.length === 0 || zoneSel.some((z) => territoryNamesEqual(z, zoneName));
        const regionOk =
          regionSel.length === 0 || regionSel.some((r) => territoryNamesEqual(r, regionName));
        // Agar oblast tanlangan bo‘lsa — faqat shu oblast; aks holda zona ostidagi barcha shahar
        if (regionSel.length > 0) {
          if (regionOk) cities.add(name);
        } else if (zoneOk) {
          cities.add(name);
        }
      }
      if (n.children?.length) walk(n.children, depth + 1, nextPath);
    }
  };
  walk(territoryNodes ?? [], 0, []);

  const toOpts = (names: string[]) =>
    names
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((v) => ({ value: v, label: v }));

  return {
    zones: toOpts(Array.from(zones)),
    regions: toOpts(Array.from(regions)),
    cities: toOpts(Array.from(cities))
  };
}

/** Daraxt bo‘yicha pastki darajalarni to‘liq yig‘ish (bulk avto-tanlash). */
export function expandTerritoryTreeDescendants(
  territoryNodes: TerritoryNode[] | undefined,
  selectedZones: string[],
  selectedRegions: string[]
): { regions: string[]; cities: string[] } {
  const cascade = buildTerritoryTreeOnlyCascade(territoryNodes, {
    zones: selectedZones,
    regions: selectedRegions
  });
  // Agar faqat zona tanlangan — barcha oblast + shahar
  if (selectedZones.length > 0 && selectedRegions.length === 0) {
    return {
      regions: cascade.regions.map((o) => o.value),
      cities: cascade.cities.map((o) => o.value)
    };
  }
  // Oblast tanlangan — shaharlar
  if (selectedRegions.length > 0) {
    return {
      regions: selectedRegions,
      cities: cascade.cities.map((o) => o.value)
    };
  }
  return { regions: [], cities: [] };
}
