/** Sana oraliklari (oy / kun multi-select → bir nechta period). */

export type DatePeriod = { from: string; to: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymIndex(y: number, m0: number): number {
  return y * 12 + m0;
}

export function ymFromIndex(idx: number): { y: number; m: number } {
  return { y: Math.floor(idx / 12), m: idx % 12 };
}

export function monthBoundsFromYm(y: number, m0: number): DatePeriod {
  const from = `${y}-${pad2(m0 + 1)}-01`;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const to = `${y}-${pad2(m0 + 1)}-${pad2(lastDay)}`;
  return { from, to };
}

function parseYmd(s: string): Date | null {
  const t = s?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, day] = t.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

export function localYmdFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysIso(iso: string, delta: number): string | null {
  const d = parseYmd(iso);
  if (!d) return null;
  d.setDate(d.getDate() + delta);
  return localYmdFromDate(d);
}

/** Tanlangan oylarni (ymIndex) uzluksiz runlarga birlashtiradi. */
export function selectedMonthsToPeriods(selected: Iterable<number>): DatePeriod[] {
  const sorted = [...new Set(selected)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const periods: DatePeriod[] = [];
  let runStart = sorted[0]!;
  let runEnd = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (cur === runEnd + 1) {
      runEnd = cur;
      continue;
    }
    const a = ymFromIndex(runStart);
    const b = ymFromIndex(runEnd);
    periods.push({ from: monthBoundsFromYm(a.y, a.m).from, to: monthBoundsFromYm(b.y, b.m).to });
    runStart = cur;
    runEnd = cur;
  }
  const a = ymFromIndex(runStart);
  const b = ymFromIndex(runEnd);
  periods.push({ from: monthBoundsFromYm(a.y, a.m).from, to: monthBoundsFromYm(b.y, b.m).to });
  return periods;
}

/** Tanlangan kunlarni (YYYY-MM-DD) ketma-ket runlarga birlashtiradi — 1,5,9 alohida period. */
export function selectedDaysToPeriods(selected: Iterable<string>): DatePeriod[] {
  const sorted = [...new Set(selected)]
    .filter((s) => Boolean(parseYmd(s)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (sorted.length === 0) return [];
  const periods: DatePeriod[] = [];
  let runStart = sorted[0]!;
  let runEnd = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const nextOfEnd = addDaysIso(runEnd, 1);
    if (nextOfEnd && cur === nextOfEnd) {
      runEnd = cur;
      continue;
    }
    periods.push({ from: runStart, to: runEnd });
    runStart = cur;
    runEnd = cur;
  }
  periods.push({ from: runStart, to: runEnd });
  return periods;
}

export function envelopeFromPeriods(periods: DatePeriod[]): DatePeriod | null {
  if (periods.length === 0) return null;
  let from = periods[0]!.from;
  let to = periods[0]!.to;
  for (const p of periods) {
    if (p.from < from) from = p.from;
    if (p.to > to) to = p.to;
  }
  return { from, to };
}

/** URL / API: `YYYY-MM-DD_YYYY-MM-DD,YYYY-MM-DD_YYYY-MM-DD` */
export function serializeDatePeriods(periods: DatePeriod[]): string {
  return periods.map((p) => `${p.from}_${p.to}`).join(",");
}

export function parseDatePeriods(raw: string | undefined | null): DatePeriod[] {
  const s = raw?.trim() ?? "";
  if (!s) return [];
  const out: DatePeriod[] = [];
  for (const part of s.split(",")) {
    const chunk = part.trim();
    if (!chunk) continue;
    const [a, b] = chunk.split("_");
    const from = a?.trim() ?? "";
    const to = b?.trim() ?? "";
    if (!parseYmd(from) || !parseYmd(to) || from > to) continue;
    out.push({ from, to });
  }
  return out;
}

/** date_from..date_to oralig‘idagi barcha oylar (ymIndex). */
export function monthsCoveredByRange(from: string, to: string): number[] {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b || from > to) return [];
  const start = ymIndex(a.getFullYear(), a.getMonth());
  const end = ymIndex(b.getFullYear(), b.getMonth());
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export function monthsFromPeriods(periods: DatePeriod[]): number[] {
  const set = new Set<number>();
  for (const p of periods) {
    for (const idx of monthsCoveredByRange(p.from, p.to)) set.add(idx);
  }
  return [...set].sort((a, b) => a - b);
}

/** Periodlardagi barcha kunlar (YYYY-MM-DD). */
export function daysFromPeriods(periods: DatePeriod[]): string[] {
  const set = new Set<string>();
  for (const p of periods) {
    let cur: string | null = p.from;
    while (cur && cur <= p.to) {
      set.add(cur);
      cur = addDaysIso(cur, 1);
    }
  }
  return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Uzluksiz oralikdagi kunlar — faqat qisqa oraliklar uchun (seed). */
export function daysCoveredByRange(from: string, to: string, maxDays = 93): string[] {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b || from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < maxDays) {
    out.push(cur);
    const next = addDaysIso(cur, 1);
    if (!next) break;
    cur = next;
  }
  return out;
}
