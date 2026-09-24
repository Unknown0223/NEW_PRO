/**
 * Workplace binding helpers — allow-list never widens via history / full catalog fallback.
 */

/** Bindings win; order history only when no bindings. */
export function resolveIdsPreferBindings(bindings: number[], fromHistory: number[]): number[] {
  const bind = uniqPositive(bindings);
  if (bind.length > 0) return bind;
  return uniqPositive(fromHistory);
}

export function uniqPositive(ids: number[]): number[] {
  const out = new Set<number>();
  for (const id of ids) {
    if (Number.isInteger(id) && id > 0) out.add(id);
  }
  return [...out];
}

/**
 * Constrained create-context warehouses:
 * - bindings present → filter catalog
 * - agent/expeditor selected + no bindings → [] (not full tenant list)
 * - client-only strict empty → []
 * - unconstrained → full catalog
 */
export function filterWarehousesByScope<T extends { id: number }>(args: {
  warehouses: T[];
  constrained: boolean;
  warehouseIds: number[];
  selectedAgentId?: number | null;
  selectedExpeditorUserId?: number | null;
  selectedClientId?: number | null;
}): T[] {
  if (!args.constrained) return args.warehouses;
  if (args.warehouseIds.length > 0) {
    const allow = new Set(args.warehouseIds);
    return args.warehouses.filter((w) => allow.has(w.id));
  }
  const staffSelected =
    (args.selectedAgentId != null && args.selectedAgentId > 0) ||
    (args.selectedExpeditorUserId != null && args.selectedExpeditorUserId > 0);
  if (staffSelected) return [];
  if (args.selectedClientId != null && args.selectedClientId > 0) return [];
  return args.warehouses;
}

export type AgentCityLite = {
  value: string;
  label: string;
  zone: string | null;
  region: string | null;
};

/** Filter mobile tenant territory catalogs to agent assignment.
 * Always clear `regions` — agent client forms must never show viloyat pickers.
 * Empty agent cities → still clear regions (do not leave full national catalog).
 */
export function filterTerritoryRefsByAgentCities<T extends Record<string, unknown>>(
  refs: T & {
    regions?: string[];
    zones?: string[];
    cities?: string[];
    territory_cascade?: Record<string, string[]>;
  },
  agentCities: AgentCityLite[]
): T {
  if (agentCities.length === 0) {
    return { ...refs, regions: [] } as T;
  }

  const norm = (s: string) => s.trim().toLowerCase();
  const cityValues = new Set(agentCities.map((c) => norm(c.value)).filter(Boolean));
  const cityLabels = new Set(agentCities.map((c) => norm(c.label)).filter(Boolean));
  const zones = new Set(agentCities.map((c) => (c.zone ? norm(c.zone) : "")).filter(Boolean));

  const next = { ...refs } as T & {
    regions?: string[];
    zones?: string[];
    cities?: string[];
    territory_cascade?: Record<string, string[]>;
  };

  next.regions = [];
  if (Array.isArray(refs.zones) && zones.size > 0) {
    next.zones = refs.zones.filter((z) => zones.has(norm(z)));
  }
  if (Array.isArray(refs.cities)) {
    next.cities = refs.cities.filter(
      (c) => cityValues.has(norm(c)) || cityLabels.has(norm(c))
    );
  }
  if (refs.territory_cascade && typeof refs.territory_cascade === "object") {
    const cascade: Record<string, string[]> = {};
    for (const [key, list] of Object.entries(refs.territory_cascade)) {
      if (!Array.isArray(list)) continue;
      const filtered = list.filter(
        (c) => cityValues.has(norm(c)) || cityLabels.has(norm(c))
      );
      if (filtered.length > 0) cascade[key] = filtered;
    }
    next.territory_cascade = cascade;
  }

  return next;
}
