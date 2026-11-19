/** Asia/Tashkent (UTC+5) oy oralig‘i — [from, to). */

export type Period = { year: number; month: number };

const OFFSET_MS = 5 * 3_600_000;

export function periodKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function previousPeriod(p: Period): Period {
  return p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 };
}

export function shiftPeriod(p: Period, delta: number): Period {
  const index = p.year * 12 + p.month - 1 + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** Toshkent kalendar oyining UTC Date chegaralari. */
export function monthRangeUtc(p: Period): { from: Date; to: Date } {
  const fromMs = Date.parse(
    `${p.year}-${String(p.month).padStart(2, "0")}-01T00:00:00+05:00`
  );
  const next =
    p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 };
  const toMs = Date.parse(
    `${next.year}-${String(next.month).padStart(2, "0")}-01T00:00:00+05:00`
  );
  return { from: new Date(fromMs), to: new Date(toMs) };
}

export function tashkentTodayYmd(now = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function daysInMonth(p: Period): number {
  return new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
}

/** Manba oyi joriy Toshkent oyiga teng bo‘lsa MTD (provisional). */
export function sourceMonthStatus(
  source: Period,
  now = new Date()
): { status: "final" | "provisional"; observedDays: number; daysInMonth: number } {
  const today = tashkentTodayYmd(now);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));
  const dim = daysInMonth(source);
  if (source.year === y && source.month === m) {
    return { status: "provisional", observedDays: Math.min(d, dim), daysInMonth: dim };
  }
  if (source.year > y || (source.year === y && source.month > m)) {
    return { status: "provisional", observedDays: 0, daysInMonth: dim };
  }
  return { status: "final", observedDays: dim, daysInMonth: dim };
}
