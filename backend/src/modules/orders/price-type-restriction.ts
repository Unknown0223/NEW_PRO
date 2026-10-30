/**
 * Agent / expeditor price-type allow-lists for order create + mobile.
 * Empty allow-list means «no restriction» (return full catalog).
 */

export function parsePriceTypeList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

export function mergeUniquePriceTypes(...lists: string[][]): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      const t = item.trim();
      if (t) out.add(t);
    }
  }
  return [...out];
}

export function intersectPriceTypes(a: string[], b: string[]): string[] {
  if (a.length === 0 || b.length === 0) return [];
  const bNorm = new Set(b.map((x) => x.trim().toLowerCase()));
  return a.filter((x) => bNorm.has(x.trim().toLowerCase()));
}

/**
 * Entitlements whitelist (Ограничения) wins when non-empty.
 * Otherwise fall back to denormalized agent_price_types + legacy price_type.
 */
export function resolveAgentAllowedPriceTypes(input: {
  entitlementsPriceTypes: string[];
  agentPriceTypes: string[];
  legacyPriceType?: string | null;
}): string[] {
  const ent = mergeUniquePriceTypes(input.entitlementsPriceTypes);
  if (ent.length > 0) return ent;
  const legacy = input.legacyPriceType?.trim() ? [input.legacyPriceType.trim()] : [];
  return mergeUniquePriceTypes(input.agentPriceTypes, legacy);
}

/** Case-insensitive catalog ∩ allow-list. Null/empty allow → full catalog. */
export function filterCatalogByAllowedPriceTypes(
  catalog: string[],
  allowed: string[] | null | undefined
): string[] {
  if (allowed == null || allowed.length === 0) return catalog;
  const allow = new Set(
    allowed.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0)
  );
  if (allow.size === 0) return catalog;
  const filtered = catalog.filter((x) => allow.has(x.trim().toLowerCase()));
  if (filtered.length > 0) return filtered;
  // Catalog keys may not match saved labels — still surface the restriction.
  return mergeUniquePriceTypes(allowed);
}

export function filterPriceTypeOptionsByAllowed<T extends { id: string }>(
  options: T[],
  allowed: string[] | null | undefined
): T[] {
  if (allowed == null || allowed.length === 0) return options;
  const allow = new Set(
    allowed.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0)
  );
  if (allow.size === 0) return options;
  return options.filter((o) => allow.has(String(o.id).trim().toLowerCase()));
}
