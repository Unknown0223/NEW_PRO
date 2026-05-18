import { asRecord } from "./tenant-settings.shared";
import type { TerritoryNodeDto } from "./tenant-settings.types";
import {
  stringArrayFromUnknown,
  territoryNodesFromUnknown,
  territoryTreeFromUnknown
} from "./tenant-settings.refs";
import {
  lalakuExpandRegionFilterTokens,
  normKeyTerritoryMatch
} from "../../../shared/territory-lalaku-seed";

function maxTerritoryDepth(nodes: TerritoryNodeDto[]): number {
  if (!nodes?.length) return 0;
  let m = 1;
  for (const n of nodes) {
    const ch = n.children ?? [];
    if (ch.length) m = Math.max(m, 1 + maxTerritoryDepth(ch));
  }
  return m;
}

function activeTerritoryNamesAtDepth(nodes: TerritoryNodeDto[], targetDepth: number): string[] {
  const out = new Set<string>();
  const walk = (list: TerritoryNodeDto[], d: number) => {
    for (const n of list) {
      if (n.active !== false && d === targetDepth) {
        const t = (n.name ?? "").trim();
        if (t) out.add(t);
      }
      const ch = n.children ?? [];
      if (ch.length) walk(ch, d + 1);
    }
  };
  walk(nodes, 0);
  return [...out].sort((a, b) => a.localeCompare(b, "ru"));
}

/**
 * Mijoz «Teritoriya», filial «Территория», `references.regions` — daraxtdan faqat viloyat qatlami.
 * 3+ daraja (masalan Zona→Oblast→Gorod) bo‘lsa ildizdagi zonalar ro‘yxatga kirmaydi.
 */
export function territoryRegionPickerNames(ref: Record<string, unknown> | undefined): string[] {
  if (ref == null) return [];
  const nodes = territoryNodesFromUnknown(ref.territory_nodes);
  if (nodes.length === 0) {
    return stringArrayFromUnknown(ref.regions);
  }
  const L = stringArrayFromUnknown(ref.territory_levels).length;
  const treeDepth = maxTerritoryDepth(nodes);
  let d = 0;
  if (L >= 3) d = 1;
  else if (L >= 1) d = 0;
  else if (treeDepth >= 3) d = 1;
  else d = 0;
  const picked = activeTerritoryNamesAtDepth(nodes, d);
  return picked.length > 0 ? picked : stringArrayFromUnknown(ref.regions);
}

/**
 * «Teritoriya» tanlovi: DB / importda saqlanadigan `stored` (kod yoki nom) va UI da ko‘rinadigan nom.
 * `territoryRegionPickerNames` bilan bir xil qatlam chuqirligi.
 */
export function territoryRegionStoredPairs(
  ref: Record<string, unknown> | undefined
): { stored: string; name: string }[] {
  if (ref == null) return [];
  const nodes = territoryNodesFromUnknown(ref.territory_nodes);
  if (nodes.length === 0) return [];
  const L = stringArrayFromUnknown(ref.territory_levels).length;
  const treeDepth = maxTerritoryDepth(nodes);
  let d = 0;
  if (L >= 3) d = 1;
  else if (L >= 1) d = 0;
  else if (treeDepth >= 3) d = 1;
  else d = 0;

  const byStored = new Map<string, string>();
  const walk = (list: TerritoryNodeDto[], depth: number) => {
    for (const n of list) {
      if (n.active !== false && depth === d) {
        const name = (n.name ?? "").trim();
        if (!name) continue;
        const codeRaw = (n.code ?? "").trim().toUpperCase();
        const stored =
          codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : name;
        if (!byStored.has(stored)) byStored.set(stored, name);
      }
      const ch = n.children ?? [];
      if (ch.length) walk(ch, depth + 1);
    }
  };
  walk(nodes, 0);
  return [...byStored.entries()].map(([stored, name]) => ({ stored, name }));
}

/**
 * Viloyat filtri qiymati (kod yoki nom) uchun `clients.region` ustunida qidiriladigan barcha sinonimlar:
 * Lalaku standartlari, `territory_nodes` juftlari, `references.regions` ro‘yxati.
 */
export function expandRegionFilterSynonyms(
  ref: Record<string, unknown> | undefined,
  regionFilter: string
): string[] {
  const rf = regionFilter.trim();
  if (!rf) return [];
  const out = new Set<string>();
  for (const x of lalakuExpandRegionFilterTokens(rf)) out.add(x);

  const rfNorm = normKeyTerritoryMatch(rf);
  for (const { stored, name } of territoryRegionStoredPairs(ref)) {
    const matches =
      stored === rf ||
      name === rf ||
      normKeyTerritoryMatch(stored) === rfNorm ||
      normKeyTerritoryMatch(name) === rfNorm;
    if (matches) {
      out.add(stored);
      out.add(name);
    }
  }

  for (const s of stringArrayFromUnknown(ref?.regions)) {
    if (s === rf || normKeyTerritoryMatch(s) === rfNorm) out.add(s);
  }

  return [...out].filter((x) => x.length > 0);
}

/** Filiallar «shahar» tanlovi — daraxtning shahar qatlami. */
export function territoryCityPickerNames(ref: Record<string, unknown> | undefined): string[] {
  if (ref == null) return [];
  const nodes = territoryNodesFromUnknown(ref.territory_nodes);
  if (nodes.length === 0) return [];
  const L = stringArrayFromUnknown(ref.territory_levels).length;
  const treeDepth = maxTerritoryDepth(nodes);
  let d = 1;
  if (L >= 3) d = 2;
  else if (L === 2) d = 1;
  else if (L === 1) d = 1;
  else if (treeDepth >= 3) d = 2;
  else if (treeDepth >= 2) d = 1;
  else d = 1;
  return activeTerritoryNamesAtDepth(nodes, d);
}

/**
 * Shahar qatlami uchun `stored` (DB / filtrda — kod bo‘lsa kod, aks holda nom) va ko‘rinish nomi.
 * Importda kod yoki nom bo‘yicha moslash, UI da `label` chiqarish uchun.
 */
export function territoryCityStoredPairs(
  ref: Record<string, unknown> | undefined
): { stored: string; name: string }[] {
  if (ref == null) return [];
  const nodes = territoryNodesFromUnknown(ref.territory_nodes);
  if (nodes.length === 0) return [];
  const L = stringArrayFromUnknown(ref.territory_levels).length;
  const treeDepth = maxTerritoryDepth(nodes);
  let d = 1;
  if (L >= 3) d = 2;
  else if (L === 2) d = 1;
  else if (L === 1) d = 1;
  else if (treeDepth >= 3) d = 2;
  else if (treeDepth >= 2) d = 1;
  else d = 1;

  const byStored = new Map<string, string>();
  const walk = (list: TerritoryNodeDto[], depth: number) => {
    for (const n of list) {
      if (n.active !== false && depth === d) {
        const name = (n.name ?? "").trim();
        if (!name) {
          /* skip */
        } else {
          const codeRaw = (n.code ?? "").trim().toUpperCase();
          const stored =
            codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : name;
          if (!byStored.has(stored)) byStored.set(stored, name);
        }
      }
      const ch = n.children ?? [];
      if (ch.length) walk(ch, depth + 1);
    }
  };
  walk(nodes, 0);
  return [...byStored.entries()].map(([stored, name]) => ({ stored, name }));
}

export type CityTerritoryHintDto = {
  /** Daraxtdagi shahar nomi (UI uchun kod o‘rniga). */
  city_label: string | null;
  region_stored: string | null;
  region_label: string | null;
  zone_stored: string | null;
  zone_label: string | null;
  /** 4+ qavatli daraxtda viloyat va shahar orasidagi qatlam (tuman / район). */
  district_stored: string | null;
  district_label: string | null;
};

function territoryNodeStoredValue(n: TerritoryNodeDto): string {
  const name = (n.name ?? "").trim();
  if (!name) return "";
  const codeRaw = (n.code ?? "").trim().toUpperCase();
  return codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : name;
}

/**
 * Hudud daraxtidan shahar (kod yoki nom) bo‘yicha viloyat va (3+ qavatda) zona ildizini chiqaradi.
 */
export function buildCityTerritoryHints(
  ref: Record<string, unknown> | undefined
): Record<string, CityTerritoryHintDto> {
  const out: Record<string, CityTerritoryHintDto> = {};
  if (ref == null) return out;
  const nodes = territoryNodesFromUnknown(ref.territory_nodes);
  if (nodes.length === 0) return out;

  const L = stringArrayFromUnknown(ref.territory_levels).length;
  const treeDepth = maxTerritoryDepth(nodes);

  let cityD = 1;
  if (L >= 3) cityD = 2;
  else if (L === 2) cityD = 1;
  else if (L === 1) cityD = 1;
  else if (treeDepth >= 3) cityD = 2;
  else if (treeDepth >= 2) cityD = 1;
  else cityD = 1;

  let regionD = 0;
  if (L >= 3) regionD = 1;
  else if (L >= 1) regionD = 0;
  else if (treeDepth >= 3) regionD = 1;
  else regionD = 0;

  const addHintKeys = (hint: CityTerritoryHintDto, stored: string, displayName: string) => {
    const keys = new Set<string>();
    const push = (k: string) => {
      const t = k.trim();
      if (!t) return;
      keys.add(t);
      keys.add(t.toUpperCase());
      const nk = normKeyTerritoryMatch(t);
      if (nk) keys.add(nk);
    };
    push(stored);
    push(displayName);
    for (const k of keys) {
      if (!(k in out)) out[k] = hint;
    }
  };

  const walk = (list: TerritoryNodeDto[], depth: number, ancestors: TerritoryNodeDto[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const chain = [...ancestors, n];
      const ch = n.children ?? [];

      if (depth === cityD) {
        const displayName = (n.name ?? "").trim();
        if (displayName) {
          const stored = territoryNodeStoredValue(n);
          const regionNode = chain[regionD];
          const zoneNode = regionD >= 1 ? chain[0] : null;

          let region_stored: string | null = null;
          let region_label: string | null = null;
          if (regionNode && regionNode !== n) {
            region_stored = territoryNodeStoredValue(regionNode) || null;
            region_label = (regionNode.name ?? "").trim() || null;
          }

          let zone_stored: string | null = null;
          let zone_label: string | null = null;
          if (regionD >= 1 && zoneNode) {
            zone_stored = territoryNodeStoredValue(zoneNode) || null;
            zone_label = (zoneNode.name ?? "").trim() || null;
          }

          let district_stored: string | null = null;
          let district_label: string | null = null;
          if (cityD >= regionD + 2) {
            const dNode = chain[cityD - 1];
            if (dNode && dNode !== n && dNode !== regionNode) {
              district_stored = territoryNodeStoredValue(dNode) || null;
              district_label = (dNode.name ?? "").trim() || null;
            }
          }

          const hint: CityTerritoryHintDto = {
            city_label: displayName,
            region_stored,
            region_label,
            zone_stored,
            zone_label,
            district_stored,
            district_label
          };
          addHintKeys(hint, stored, displayName);
        }
      }

      if (ch.length) walk(ch, depth + 1, chain);
    }
  };

  walk(nodes, 0, []);
  return out;
}

function legacyRowsToNodes(rows: { zone: string; region: string; cities: string[] }[]): TerritoryNodeDto[] {
  return rows.map((r, i) => ({
    id: `legacy-z-${i}`,
    name: r.zone,
    code: null,
    comment: null,
    sort_order: null,
    active: true,
    children: [
      {
        id: `legacy-z-${i}-r`,
        name: r.region,
        code: null,
        comment: null,
        sort_order: null,
        active: true,
        children: r.cities.map((c, j) => ({
          id: `legacy-z-${i}-c-${j}`,
          name: c,
          code: null,
          comment: null,
          sort_order: null,
          active: true,
          children: []
        }))
      }
    ]
  }));
}

/**
 * `territory_nodes` bo‘sh, lekin `territory_tree` (legacy) bor bo‘lsa — ikkalasini birlashtiradi.
 * `getTenantProfile` va `getClientReferences` bir xil manbadan foydalansin.
 */
export function referencesWithResolvedTerritoryNodes(
  ref: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (ref == null) return {};
  let territory_nodes = territoryNodesFromUnknown(ref.territory_nodes);
  const territory_tree = territoryTreeFromUnknown(ref.territory_tree);
  if (territory_nodes.length === 0 && territory_tree.length > 0) {
    territory_nodes = legacyRowsToNodes(territory_tree);
  }
  return { ...ref, territory_nodes };
}
