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

/**
 * Zona / oblast / shahar ro‘yxatlaridan territory satrlari.
 * Shaharlar bo‘lsa — har bir shahar + mos ota (zip yoki birinchi); aks holda oblast/zona.
 */
export function buildTerritoriesFromPartLists(args: {
  zones?: string[] | null;
  oblasts?: string[] | null;
  cities?: string[] | null;
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
    for (let i = 0; i < cities.length; i++) {
      push(
        buildUserTerritory({
          zone: zones[Math.min(i, Math.max(0, zones.length - 1))] ?? zones[0] ?? null,
          oblast: oblasts[Math.min(i, Math.max(0, oblasts.length - 1))] ?? oblasts[0] ?? null,
          city: cities[i]!
        })
      );
    }
    return out;
  }
  if (oblasts.length > 0) {
    for (let i = 0; i < oblasts.length; i++) {
      push(
        buildUserTerritory({
          zone: zones[Math.min(i, Math.max(0, zones.length - 1))] ?? zones[0] ?? null,
          oblast: oblasts[i]!,
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
