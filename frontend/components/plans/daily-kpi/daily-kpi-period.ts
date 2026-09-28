export type DailyKpiPeriodPreset = "day" | "week" | "month" | "custom";

export type DailyKpiPeriod = { preset: DailyKpiPeriodPreset; from: string; to: string };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return [y!, m!, d!];
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function monthFirstYmd(ymd: string): string {
  const [y, m] = parts(ymd);
  return toYmd(y, m, 1);
}

export function monthLastYmd(ymd: string): string {
  const [y, m] = parts(ymd);
  return toYmd(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

function maxYmd(a: string, b: string): string {
  return a > b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a < b ? a : b;
}

/** Du–Ya hafta, lekin oy chegarasidan chiqmaydi. */
export function weekRangeInMonth(anchor: string): { from: string; to: string } {
  const [y, m, d] = parts(anchor);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const mondayOffset = (dt.getUTCDay() + 6) % 7;
  const mon = new Date(dt);
  mon.setUTCDate(dt.getUTCDate() - mondayOffset);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const from = maxYmd(mon.toISOString().slice(0, 10), monthFirstYmd(anchor));
  const to = minYmd(sun.toISOString().slice(0, 10), monthLastYmd(anchor));
  return { from, to };
}

export function presetRange(
  preset: Exclude<DailyKpiPeriodPreset, "custom">,
  anchor: string
): { from: string; to: string } {
  if (preset === "week") return weekRangeInMonth(anchor);
  if (preset === "month") return { from: monthFirstYmd(anchor), to: monthLastYmd(anchor) };
  return { from: anchor, to: anchor };
}

/**
 * Qat’iy qoida: oraliq faqat `anchorMonth` oyi ichida.
 * Chegaradan tashqaridagi qiymatlar oy boshiga/oxiriga qisiladi, from ≤ to.
 */
export function clampRangeToMonth(
  from: string,
  to: string,
  anchorMonth: string
): { from: string; to: string } {
  const first = monthFirstYmd(anchorMonth);
  const last = monthLastYmd(anchorMonth);
  const f = YMD.test(from) ? minYmd(maxYmd(from, first), last) : first;
  const t = YMD.test(to) ? minYmd(maxYmd(to, first), last) : f;
  return t < f ? { from: f, to: f } : { from: f, to: t };
}

/** Yuqoridagi kun (anchor) o‘zgarganda davrni qayta hisoblash. */
export function periodForAnchor(prev: DailyKpiPeriod, anchor: string): DailyKpiPeriod {
  if (prev.preset === "custom") {
    if (sameMonth(prev.from, anchor)) return prev;
    return { preset: "custom", from: anchor, to: anchor };
  }
  return { preset: prev.preset, ...presetRange(prev.preset, anchor) };
}

export function periodDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function formatPeriodLabel(from: string, to: string): string {
  const [fy, fm, fd] = parts(from);
  const [, tm, td] = parts(to);
  const dd = (d: number, m: number) => `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
  if (from === to) {
    const weekday = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay()] ?? "";
    return `${dd(fd, fm)}.${fy} · ${weekday}`;
  }
  return `${dd(fd, fm)}–${dd(td, tm)}.${fy} · ${periodDays(from, to)} дн.`;
}
