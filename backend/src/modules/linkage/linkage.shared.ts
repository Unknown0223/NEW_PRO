export function parseEntitledProductIds(ent: unknown): { ids: number[]; restricted: boolean } {
  if (ent == null || typeof ent !== "object" || Array.isArray(ent)) {
    return { ids: [], restricted: false };
  }
  const obj = ent as Record<string, unknown>;
  const rulesRaw = obj.product_rules;
  if (!Array.isArray(rulesRaw) || rulesRaw.length === 0) {
    return { ids: [], restricted: false };
  }
  const ids = new Set<number>();
  let restricted = false;
  for (const r of rulesRaw) {
    if (r == null || typeof r !== "object" || Array.isArray(r)) continue;
    const row = r as Record<string, unknown>;
    const all = row.all === true;
    if (all) {
      restricted = true;
      continue;
    }
    const pids = Array.isArray(row.product_ids)
      ? row.product_ids
          .map((x) => (typeof x === "number" ? x : Number(x)))
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (pids.length > 0) restricted = true;
    for (const id of pids) ids.add(id);
  }
  return { ids: [...ids], restricted };
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
