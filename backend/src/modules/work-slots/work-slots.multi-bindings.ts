/** WorkSlot multi warehouse / cash desk / territory — normalizatsiya. */

import { buildUserTerritory } from "./work-slots.config-territory";

export function normalizePositiveIntIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseInt(v, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(Math.trunc(n));
  }
  return out;
}

export function normalizeTerritoryList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Singular + array patch → yakuniy ids; singular ustun birinchi. */
export function resolveWarehouseIdsPatch(args: {
  existingIds: number[];
  existingPrimary: number | null | undefined;
  warehouse_ids?: number[] | null;
  warehouse_id?: number | null;
}): { warehouse_ids: number[]; warehouse_id: number | null } | undefined {
  if (args.warehouse_ids === undefined && args.warehouse_id === undefined) return undefined;
  let ids: number[];
  if (args.warehouse_ids !== undefined) {
    ids = normalizePositiveIntIds(args.warehouse_ids);
  } else {
    ids = [...(args.existingIds.length ? args.existingIds : args.existingPrimary ? [args.existingPrimary] : [])];
    if (args.warehouse_id === null) ids = [];
    else if (args.warehouse_id != null && args.warehouse_id > 0) {
      ids = [args.warehouse_id, ...ids.filter((id) => id !== args.warehouse_id)];
    }
  }
  if (args.warehouse_id !== undefined && args.warehouse_ids === undefined) {
    // already handled
  } else if (args.warehouse_id !== undefined && args.warehouse_ids !== undefined) {
    if (args.warehouse_id != null && args.warehouse_id > 0 && !ids.includes(args.warehouse_id)) {
      ids = [args.warehouse_id, ...ids];
    } else if (args.warehouse_id === null) {
      ids = [];
    } else if (args.warehouse_id != null && args.warehouse_id > 0) {
      ids = [args.warehouse_id, ...ids.filter((id) => id !== args.warehouse_id)];
    }
  }
  return {
    warehouse_ids: ids,
    warehouse_id: ids[0] ?? null
  };
}

export function resolveCashDeskIdsPatch(args: {
  existingIds: number[];
  existingPrimary: number | null | undefined;
  cash_desk_ids?: number[] | null;
  cash_desk_id?: number | null;
}): { cash_desk_ids: number[]; cash_desk_id: number | null } | undefined {
  if (args.cash_desk_ids === undefined && args.cash_desk_id === undefined) return undefined;
  let ids: number[];
  if (args.cash_desk_ids !== undefined) {
    ids = normalizePositiveIntIds(args.cash_desk_ids);
  } else {
    ids = [...(args.existingIds.length ? args.existingIds : args.existingPrimary ? [args.existingPrimary] : [])];
    if (args.cash_desk_id === null) ids = [];
    else if (args.cash_desk_id != null && args.cash_desk_id > 0) {
      ids = [args.cash_desk_id, ...ids.filter((id) => id !== args.cash_desk_id)];
    }
  }
  if (args.cash_desk_ids !== undefined && args.cash_desk_id !== undefined) {
    if (args.cash_desk_id != null && args.cash_desk_id > 0) {
      ids = [args.cash_desk_id, ...ids.filter((id) => id !== args.cash_desk_id)];
    } else if (args.cash_desk_id === null) {
      ids = [];
    }
  }
  return {
    cash_desk_ids: ids,
    cash_desk_id: ids[0] ?? null
  };
}

export function resolveTerritoriesPatch(args: {
  existingList: string[];
  existingPrimary: string | null | undefined;
  territories?: string[] | null;
  territory?: string | null;
  /** Singular patch: birinchi (primary) ni almashtirish — eski primary ro‘yxatda qolmasin. */
  replacePrimary?: boolean;
}): { territories: string[]; territory: string | null } | undefined {
  if (args.territories === undefined && args.territory === undefined) return undefined;
  let list: string[];
  if (args.territories !== undefined) {
    list = normalizeTerritoryList(args.territories);
  } else {
    list = [
      ...(args.existingList.length
        ? args.existingList
        : args.existingPrimary?.trim()
          ? [args.existingPrimary.trim()]
          : [])
    ];
    if (args.territory === null) list = [];
    else if (args.territory != null && args.territory.trim()) {
      const t = args.territory.trim();
      if (args.replacePrimary) {
        const rest = list.slice(1);
        list = [t, ...rest.filter((x) => x !== t)];
      } else {
        list = [t, ...list.filter((x) => x !== t)];
      }
    }
  }
  if (args.territories !== undefined && args.territory !== undefined) {
    if (args.territory != null && args.territory.trim()) {
      const t = args.territory.trim();
      list = [t, ...list.filter((x) => x !== t)];
    } else if (args.territory === null) {
      list = [];
    }
  }
  return {
    territories: list,
    territory: list[0] ?? null
  };
}

/** Slotdagi effective id lar (array yoki singular). */
export function effectiveWarehouseIds(slot: {
  warehouse_ids?: number[] | null;
  warehouse_id?: number | null;
}): number[] {
  const fromArr = normalizePositiveIntIds(slot.warehouse_ids ?? []);
  if (fromArr.length) return fromArr;
  return slot.warehouse_id != null && slot.warehouse_id > 0 ? [slot.warehouse_id] : [];
}

export function effectiveCashDeskIds(slot: {
  cash_desk_ids?: number[] | null;
  cash_desk_id?: number | null;
}): number[] {
  const fromArr = normalizePositiveIntIds(slot.cash_desk_ids ?? []);
  if (fromArr.length) return fromArr;
  return slot.cash_desk_id != null && slot.cash_desk_id > 0 ? [slot.cash_desk_id] : [];
}

export function effectiveTerritories(slot: {
  territories?: string[] | null;
  territory?: string | null;
}): string[] {
  const fromArr = normalizeTerritoryList(slot.territories ?? []);
  if (fromArr.length) return fromArr;
  const t = slot.territory?.trim();
  return t ? [t] : [];
}

export function resolveBranchCodesPatch(args: {
  existingCodes: string[];
  existingPrimary: string | null | undefined;
  branch_codes?: string[] | null;
  branch_code?: string | null;
}): { branch_codes: string[]; branch_code: string | null } | undefined {
  if (args.branch_codes === undefined && args.branch_code === undefined) return undefined;
  let list: string[];
  if (args.branch_codes !== undefined) {
    list = normalizeTerritoryList(args.branch_codes);
  } else {
    list = [
      ...(args.existingCodes.length
        ? args.existingCodes
        : args.existingPrimary?.trim()
          ? [args.existingPrimary.trim()]
          : [])
    ];
    if (args.branch_code === null) list = [];
    else if (args.branch_code != null && args.branch_code.trim()) {
      const t = args.branch_code.trim();
      list = [t, ...list.filter((x) => x !== t)];
    }
  }
  if (args.branch_codes !== undefined && args.branch_code !== undefined) {
    if (args.branch_code != null && args.branch_code.trim()) {
      const t = args.branch_code.trim();
      list = [t, ...list.filter((x) => x !== t)];
    } else if (args.branch_code === null) {
      list = [];
    }
  }
  return {
    branch_codes: list,
    branch_code: list[0] ?? null
  };
}

export function effectiveBranchCodes(slot: {
  branch_codes?: string[] | null;
  branch_code?: string | null;
}): string[] {
  const fromArr = normalizeTerritoryList(slot.branch_codes ?? []);
  if (fromArr.length) return fromArr;
  const t = slot.branch_code?.trim();
  return t ? [t] : [];
}

function territoryTokenKey(s: string): string {
  return s.trim().toUpperCase().replace(/[\s\-_]+/g, " ");
}

/**
 * Zona / oblast / shahar ro‘yxatlaridan territory satrlari.
 * Shaharlar bo‘lsa — har bir shahar uchun daraxt ota-onasi (yoki tanlangan zona/oblast).
 * Oblastlar bo‘lsa — zona daraxt/resolve orqali to‘ldiriladi (zona’siz saqlash taqiqlanadi).
 */
export function buildTerritoriesFromPartLists(args: {
  zones?: string[] | null;
  oblasts?: string[] | null;
  cities?: string[] | null;
  /** ixtiyoriy: shahar → haqiqiy zona/oblast (index-zip o‘rniga) */
  resolveCityParents?: (
    city: string
  ) => { zone: string | null; oblast: string | null; city?: string | null } | null;
  /** ixtiyoriy: oblast → zona (bulkda faqat viloyat tanlanganda) */
  resolveOblastParents?: (oblast: string) => { zone: string | null } | null;
}): string[] {
  const zones = normalizeTerritoryList(args.zones ?? []);
  const oblasts = normalizeTerritoryList(args.oblasts ?? []);
  const cities = normalizeTerritoryList(args.cities ?? []);
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (s: string | null) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  if (cities.length > 0) {
    for (const city of cities) {
      const resolved = args.resolveCityParents?.(city) ?? null;
      const zone =
        resolved?.zone?.trim() ||
        (zones.length === 1 ? zones[0]! : zones[0] ?? null);
      const oblast =
        resolved?.oblast?.trim() ||
        (oblasts.length === 1 ? oblasts[0]! : oblasts[0] ?? null);
      const cityName = resolved?.city?.trim() || city;
      push(
        buildUserTerritory({
          zone,
          oblast,
          city: cityName
        })
      );
    }
    return out;
  }
  if (oblasts.length > 0) {
    for (const oblast of oblasts) {
      const resolved = args.resolveOblastParents?.(oblast) ?? null;
      const zone =
        resolved?.zone?.trim() ||
        (zones.length === 1 ? zones[0]! : zones[0] ?? null);
      push(
        buildUserTerritory({
          zone,
          oblast,
          city: null
        })
      );
    }
    return out;
  }
  for (const zone of zones) {
    push(buildUserTerritory({ zone, oblast: null, city: null }));
  }
  return out;
}

/** Hudud daraxtidan oblast ota-zonasini topish. */
export function findOblastParentsInTerritoryTree(
  nodes: Array<{ name?: string; active?: boolean; children?: unknown[] }> | null | undefined,
  oblast: string
): { zone: string | null } | null {
  const want = territoryTokenKey(oblast);
  if (!want || !nodes?.length) return null;

  let found: { zone: string | null } | null = null;

  const walk = (
    list: Array<{ name?: string; active?: boolean; children?: unknown[] }>,
    depth: number,
    path: string[]
  ) => {
    if (found) return;
    for (const n of list) {
      if (n.active === false) continue;
      const name = typeof n.name === "string" ? n.name.trim() : "";
      if (!name) continue;
      const nextPath = [...path, name];
      const key = territoryTokenKey(name);
      if (depth === 1 && key === want) {
        found = { zone: nextPath[0] ?? null };
        return;
      }
      const children = Array.isArray(n.children)
        ? (n.children as Array<{ name?: string; active?: boolean; children?: unknown[] }>)
        : [];
      if (children.length) walk(children, depth + 1, nextPath);
    }
  };

  walk(nodes, 0, []);
  return found;
}

/** Hudud daraxtidan shahar ota-onasini topish (nom bo‘yicha, case-insensitive). */
export function findCityParentsInTerritoryTree(
  nodes: Array<{ name?: string; active?: boolean; children?: unknown[] }> | null | undefined,
  city: string
): { zone: string | null; oblast: string | null; city?: string } | null {
  const want = territoryTokenKey(city);
  if (!want || !nodes?.length) return null;

  let found: { zone: string | null; oblast: string | null; city?: string } | null = null;

  const nameMatches = (key: string) => {
    if (key === want) return true;
    // XR_BERUNIY ↔ BERUNIY
    if (key.endsWith(` ${want}`)) return true;
    const keyParts = key.split(/[\s_]+/).filter(Boolean);
    const wantParts = want.split(/[\s_]+/).filter(Boolean);
    if (wantParts.length === 1 && keyParts.length >= 2 && keyParts[keyParts.length - 1] === wantParts[0]) {
      return true;
    }
    return false;
  };

  const walk = (
    list: Array<{ name?: string; active?: boolean; children?: unknown[] }>,
    depth: number,
    path: string[]
  ) => {
    if (found) return;
    for (const n of list) {
      if (n.active === false) continue;
      const name = typeof n.name === "string" ? n.name.trim() : "";
      if (!name) continue;
      const nextPath = [...path, name];
      const key = territoryTokenKey(name);
      if (depth >= 2 && nameMatches(key)) {
        found = { zone: nextPath[0] ?? null, oblast: nextPath[1] ?? null, city: name };
        return;
      }
      const children = Array.isArray(n.children)
        ? (n.children as Array<{ name?: string; active?: boolean; children?: unknown[] }>)
        : [];
      if (children.length) walk(children, depth + 1, nextPath);
    }
  };

  walk(nodes, 0, []);
  return found;
}

type TerritoryDepthIndex = {
  zones: Map<string, string>;
  regions: Map<string, { name: string; zone: string }>;
  cities: Map<string, { name: string; zone: string; oblast: string }>;
};

function buildTerritoryDepthIndex(
  nodes: Array<{ name?: string; active?: boolean; children?: unknown[] }> | null | undefined
): TerritoryDepthIndex {
  const zones = new Map<string, string>();
  const regions = new Map<string, { name: string; zone: string }>();
  const cities = new Map<string, { name: string; zone: string; oblast: string }>();

  const walk = (
    list: Array<{ name?: string; active?: boolean; children?: unknown[] }>,
    depth: number,
    path: string[]
  ) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = typeof n.name === "string" ? n.name.trim() : "";
      if (!name) continue;
      const next = [...path, name];
      const key = territoryTokenKey(name);
      if (depth === 0) zones.set(key, name);
      else if (depth === 1 && next[0]) regions.set(key, { name, zone: next[0] });
      else if (depth >= 2 && next[0] && next[1]) {
        cities.set(key, { name, zone: next[0], oblast: next[1] });
        const parts = key.split(/[\s_]+/).filter(Boolean);
        if (parts.length >= 2) {
          const tail = parts[parts.length - 1]!;
          if (tail && !cities.has(tail)) {
            cities.set(tail, { name, zone: next[0], oblast: next[1] });
          }
        }
      }
      const children = Array.isArray(n.children)
        ? (n.children as Array<{ name?: string; active?: boolean; children?: unknown[] }>)
        : [];
      if (children.length) walk(children, depth + 1, next);
    }
  };
  walk(nodes ?? [], 0, []);
  return { zones, regions, cities };
}

function heuristicBareTokenKind(token: string): "zone" | "oblast" | "city" {
  const u = token.trim().toUpperCase();
  if (!u) return "city";
  if (
    u.includes("VILOYATI") ||
    u === "QORAQALPOQISTON" ||
    u === "QOQON" ||
    u === "QO'QON" ||
    u === "SAMARQAND" ||
    u === "TOSHKENT SHAHAR"
  ) {
    return "oblast";
  }
  if (
    u === "FV" ||
    u === "SOUTH-WEST" ||
    u === "SOUTH WEST" ||
    u === "TASH OBL" ||
    u === "TASHKENT" ||
    u === "TASHKENT CITY"
  ) {
    return "zone";
  }
  return "city";
}

/**
 * Saqlangan territory satrlaridan list ustunlari uchun zona/oblast/gorod.
 * Daraxt bo‘lsa — tokenlarni chuqurlik bo‘yicha klassifikatsiya + ota-onalarni to‘ldirish.
 */
export function summarizeTerritoriesForDisplay(
  territories: string[],
  nodes?: Array<{ name?: string; active?: boolean; children?: unknown[] }> | null
): { zone: string | null; oblast: string | null; city: string | null } {
  const zones: string[] = [];
  const oblasts: string[] = [];
  const cities: string[] = [];
  const push = (arr: string[], v: string | null | undefined) => {
    const t = v?.trim();
    if (!t) return;
    if (!arr.some((x) => territoryTokenKey(x) === territoryTokenKey(t))) arr.push(t);
  };

  const index = nodes?.length ? buildTerritoryDepthIndex(nodes) : null;

  for (const raw of territories) {
    const t = raw?.trim();
    if (!t) continue;
    const parts = t
      .split(/\s*\/\s*|[,;|]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      push(zones, parts[0]);
      push(oblasts, parts[1]);
      push(cities, parts[2]);
      continue;
    }
    if (parts.length === 2) {
      const a = parts[0]!;
      const b = parts[1]!;
      if (index) {
        const aKey = territoryTokenKey(a);
        const bKey = territoryTokenKey(b);
        if (index.zones.has(aKey) && index.regions.has(bKey)) {
          push(zones, index.zones.get(aKey)!);
          push(oblasts, index.regions.get(bKey)!.name);
          continue;
        }
        if (index.regions.has(aKey) && index.cities.has(bKey)) {
          const city = index.cities.get(bKey)!;
          push(zones, city.zone);
          push(oblasts, city.oblast);
          push(cities, city.name);
          continue;
        }
      }
      push(zones, a);
      push(oblasts, b);
      continue;
    }

    const only = parts[0]!;
    const key = territoryTokenKey(only);
    if (index) {
      if (index.zones.has(key)) {
        push(zones, index.zones.get(key)!);
        continue;
      }
      if (index.regions.has(key)) {
        const r = index.regions.get(key)!;
        push(zones, r.zone);
        push(oblasts, r.name);
        continue;
      }
      if (index.cities.has(key)) {
        const c = index.cities.get(key)!;
        push(zones, c.zone);
        push(oblasts, c.oblast);
        push(cities, c.name);
        continue;
      }
    }
    const kind = heuristicBareTokenKind(only);
    if (kind === "zone") push(zones, only);
    else if (kind === "oblast") push(oblasts, only);
    else push(cities, only);
  }

  const join = (arr: string[]) => (arr.length ? arr.join(", ") : null);
  return { zone: join(zones), oblast: join(oblasts), city: join(cities) };
}
