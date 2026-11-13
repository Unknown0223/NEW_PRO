/**
 * Старые цены — sof qarorlar (DB yo‘q).
 */

/** Joriy `product_prices` qatorini as-of sanasiga fallback qilish mumkinmi? */
export function canUseCurrentPriceAsOf(input: {
  asOf: Date;
  updatedAt: Date | null | undefined;
  createdAt: Date | null | undefined;
}): boolean {
  const stamp = input.updatedAt ?? input.createdAt;
  if (stamp == null || Number.isNaN(stamp.getTime())) return false;
  return stamp.getTime() <= input.asOf.getTime();
}

/**
 * Yangi narx yozilishidan oldin eski narxni schedule ga qo‘yish kerakmi?
 * `latestSchedulePrice` — hozirgi vaqtdan oldingi eng so‘nggi applied schedule narxi (yo‘q bo‘lsa null).
 */
export function shouldSnapshotPreviousPrice(input: {
  previousPrice: string;
  nextPrice: string;
  latestSchedulePrice: string | null;
}): boolean {
  const prev = input.previousPrice.trim();
  const next = input.nextPrice.trim();
  if (!prev || prev === next) return false;
  const latest = input.latestSchedulePrice?.trim() ?? null;
  if (latest == null) return true;
  return latest !== prev;
}

/** Snapshot effective_at: created_at (tarix yo‘q) yoki updated_at, lekin `now` dan oldin. */
export function snapshotEffectiveAt(input: {
  now: Date;
  createdAt: Date;
  updatedAt: Date;
  hasPriorSchedule: boolean;
}): Date {
  const base = input.hasPriorSchedule ? input.updatedAt : input.createdAt;
  const t = base.getTime();
  if (!Number.isFinite(t)) return new Date(input.now.getTime() - 1000);
  if (t >= input.now.getTime()) return new Date(input.now.getTime() - 1000);
  return base;
}
