/** Jadval sahifasi — maksimal qator (1000 qator vebni qotiradi). */
export const MAX_TABLE_PAGE_SIZE = 500;

export const DEFAULT_TABLE_PAGE_SIZES = [10, 20, 25, 50, 100, 500] as const;

export function normalizeTablePageSizes(sizes: readonly number[]): number[] {
  const out = [...new Set(sizes.filter((n) => Number.isFinite(n) && n > 0 && n <= MAX_TABLE_PAGE_SIZE))];
  out.sort((a, b) => a - b);
  return out.length ? out : [...DEFAULT_TABLE_PAGE_SIZES];
}

export function clampTablePageSize(size: number, allowed: readonly number[]): number {
  const capped = Math.min(Math.max(1, Math.round(size)), MAX_TABLE_PAGE_SIZE);
  const normalized = normalizeTablePageSizes(allowed);
  if (normalized.includes(capped)) return capped;
  let best = normalized[0] ?? DEFAULT_TABLE_PAGE_SIZES[0];
  let bestDist = Math.abs(capped - best);
  for (const n of normalized) {
    const dist = Math.abs(capped - n);
    if (dist < bestDist) {
      best = n;
      bestDist = dist;
    }
  }
  return best;
}
