export type ParsedProductEntitlementRules = {
  productIds: number[];
  allCategoryIds: number[];
  partialCategoryIds: number[];
  restricted: boolean;
};

export function parseProductEntitlementRules(ent: unknown): ParsedProductEntitlementRules {
  const empty: ParsedProductEntitlementRules = {
    productIds: [],
    allCategoryIds: [],
    partialCategoryIds: [],
    restricted: false
  };
  if (ent == null || typeof ent !== "object" || Array.isArray(ent)) return empty;
  const rulesRaw = (ent as Record<string, unknown>).product_rules;
  if (!Array.isArray(rulesRaw) || rulesRaw.length === 0) return empty;

  const productIds = new Set<number>();
  const allCategoryIds = new Set<number>();
  const partialCategoryIds = new Set<number>();
  let restricted = false;

  for (const r of rulesRaw) {
    if (r == null || typeof r !== "object" || Array.isArray(r)) continue;
    const row = r as Record<string, unknown>;
    const categoryId = Number(row.category_id);
    const hasCategory = Number.isInteger(categoryId) && categoryId > 0;
    if (row.all === true) {
      restricted = true;
      if (hasCategory) allCategoryIds.add(categoryId);
      continue;
    }
    const pids = Array.isArray(row.product_ids)
      ? row.product_ids
          .map((x) => (typeof x === "number" ? x : Number(x)))
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (pids.length === 0) continue;
    restricted = true;
    if (hasCategory) partialCategoryIds.add(categoryId);
    for (const id of pids) productIds.add(id);
  }

  return {
    productIds: [...productIds],
    allCategoryIds: [...allCategoryIds],
    partialCategoryIds: [...partialCategoryIds],
    restricted
  };
}

/** `all: true` qoidalarining mahsulotlari — qisman tanlangan kategoriya (va uning bolalari) tashqarida. */
export function collectAllTrueCategoryIds(
  allCategoryIds: number[],
  partialCategoryIds: number[],
  categories: Array<{ id: number; parent_id: number | null }>
): number[] {
  const children = new Map<number, number[]>();
  for (const c of categories) {
    if (c.parent_id == null) continue;
    const list = children.get(c.parent_id);
    if (list) list.push(c.id);
    else children.set(c.parent_id, [c.id]);
  }

  const descendantsOf = (root: number): number[] => {
    const out: number[] = [];
    const stack = [...(children.get(root) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      out.push(id);
      const ch = children.get(id);
      if (ch) stack.push(...ch);
    }
    return out;
  };

  const skip = new Set<number>();
  for (const id of partialCategoryIds) {
    skip.add(id);
    for (const d of descendantsOf(id)) skip.add(d);
  }

  const out = new Set<number>();
  for (const id of allCategoryIds) {
    if (!skip.has(id)) out.add(id);
    for (const d of descendantsOf(id)) {
      if (!skip.has(d)) out.add(d);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function parseEntitledProductIds(ent: unknown): { ids: number[]; restricted: boolean } {
  const parsed = parseProductEntitlementRules(ent);
  return { ids: parsed.productIds, restricted: parsed.restricted };
}

export function normalizeSelectedId(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw < 1) return null;
  return Math.floor(raw);
}

export function intersectNumberSets(sets: Array<Set<number>>): number[] {
  if (sets.length === 0) return [];
  const [first, ...rest] = sets;
  const out: number[] = [];
  for (const value of first) {
    if (rest.every((s) => s.has(value))) out.push(value);
  }
  return out;
}
