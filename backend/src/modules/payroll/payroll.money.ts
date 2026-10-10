/**
 * ЗАРПЛАТА — pul hisob yordamchilari (sof).
 *
 * Prisma `Decimal` DB chegarasida `number` ga aylantiriladi; hisob ichida
 * oraliq natijalar 2 xonagacha yaxlitlanadi, yakuniy summa esa formula
 * `config.round_to` bo‘yicha (so‘m uchun odatda 1/10/100).
 */

const EPSILON = 1e-9;

/** 2 xonagacha yaxlitlash (bank usuli emas — oddiy yarim yuqoriga). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `step` ga yaxlitlash: roundTo(1234, 100) → 1200. */
export function roundTo(value: number, step?: number | null): number {
  if (!Number.isFinite(value)) return 0;
  const s = Number(step);
  if (!Number.isFinite(s) || s <= 1) return round2(value);
  return Math.round(value / s) * s;
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const fn = (value as { toNumber?: () => number }).toNumber;
    if (typeof fn === "function") {
      const n = fn.call(value);
      return Number.isFinite(n) ? n : fallback;
    }
  }
  return fallback;
}

/** Yig‘indi (2 xonagacha yaxlitlangan). */
export function sumAmounts(values: Array<number | null | undefined>): number {
  let acc = 0;
  for (const v of values) acc += Number.isFinite(Number(v)) ? Number(v) : 0;
  return round2(acc);
}

/** Bo‘linish: nolga bo‘lishda `fallback`. */
export function safeDivide(a: number, b: number, fallback = 0): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < EPSILON) return fallback;
  return a / b;
}

/** Foiz: `base * percent / 100`. */
export function percentOf(base: number, percent: number): number {
  return round2(safeDivide(base * (Number.isFinite(percent) ? percent : 0), 100));
}

/** 0..1 oralig‘iga siqish. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Oy (YYYY-MM) uchun kunlar soni. */
export function daysInMonth(month: string): number {
  if (!/^\d{4}-\d{2}$/.test(month)) return 30;
  const [y, m] = month.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Joriy oy (server vaqt mintaqasida, YYYY-MM). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Oy qatorini tekshirish. */
export function isValidMonth(month: string | null | undefined): month is string {
  if (!month) return false;
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const m = Number.parseInt(month.slice(5, 7), 10);
  return m >= 1 && m <= 12;
}
