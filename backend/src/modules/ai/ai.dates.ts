/**
 * AI Assistant — sana/davr parseri (pure, testlanadigan).
 *
 * Vaqt mintaqasi: Asia/Tashkent (UTC+05:00, yozgi vaqt yo‘q).
 * Kirish matni: o‘zbek (lotin/kirill) va rus tillari.
 */

const DAY_MS = 86_400_000;
const TASHKENT_OFFSET_MS = 5 * 3_600_000;

/** `YYYY-MM-DD` (Toshkent kuni). */
export function tashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  return new Date(time).toISOString().slice(0, 10) === value;
}

export function addDays(ymd: string, days: number): string {
  const base = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(base)) return ymd;
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function monthEnd(ymd: string): string {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ymd.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Dushanba — haftaning birinchi kuni. */
export function weekStart(ymd: string): string {
  const time = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(time)) return ymd;
  const weekday = new Date(time).getUTCDay(); // 0 = yakshanba
  const shift = weekday === 0 ? 6 : weekday - 1;
  return addDays(ymd, -shift);
}

export function quarterStart(ymd: string): string {
  const month = Number(ymd.slice(5, 7));
  const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${ymd.slice(0, 4)}-${String(firstMonth).padStart(2, "0")}-01`;
}

export function yearStart(ymd: string): string {
  return `${ymd.slice(0, 4)}-01-01`;
}

export type DatePeriod = { from: string; to: string };

/** Oy nomlari (lotin/kirill/rus) → 1..12 */
const MONTHS: Record<string, number> = {
  yanvar: 1, yanvarya: 1, январь: 1, января: 1, янв: 1,
  fevral: 2, fevralya: 2, февраль: 2, февраля: 2, фев: 2,
  mart: 3, март: 3, марта: 3, мар: 3,
  aprel: 4, апрель: 4, апреля: 4, апр: 4,
  may: 5, май: 5, мая: 5,
  iyun: 6, июнь: 6, июня: 6, июн: 6,
  iyul: 7, июль: 7, июля: 7, июл: 7,
  avgust: 8, август: 8, августа: 8, авг: 8,
  sentabr: 9, sentyabr: 9, september: 9, сентябрь: 9, сентября: 9, сен: 9, сент: 9,
  oktabr: 10, oktyabr: 10, октябрь: 10, октября: 10, окт: 10,
  noyabr: 11, ноябрь: 11, ноября: 11, ноя: 11,
  dekabr: 12, декабрь: 12, декабря: 12, дек: 12
};

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

export function monthIndexByName(word: string): number | undefined {
  return MONTHS[word.trim().toLowerCase()];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdOf(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const candidate = `${year}-${pad(month)}-${pad(day)}`;
  return isValidYmd(candidate) ? candidate : undefined;
}

/**
 * Matndan davrni ajratib oladi. Topilmasa `undefined`.
 * `today` — Toshkent bugungi kuni (`YYYY-MM-DD`).
 */
export function parsePeriod(text: string, today: string = tashkentToday()): DatePeriod | undefined {
  const q = text.toLowerCase().replace(/[’‘`ʻ]/g, "'").replace(/\s+/g, " ").trim();
  const year = Number(today.slice(0, 4));

  const explicit = extractExplicitDates(q, today);
  if (explicit) return explicit;

  const relative = extractRelative(q, today);
  if (relative) return relative;

  const named = extractNamedMonth(q, year, today);
  if (named) return named;

  const lastDays = extractLastDays(q, today);
  if (lastDays) return lastDays;

  return undefined;
}

function extractExplicitDates(q: string, today: string): DatePeriod | undefined {
  const iso = q.match(/\b(\d{4})-(\d{2})-(\d{2})\b/g);
  if (iso?.length) {
    const dates = iso.filter(isValidYmd).sort();
    if (dates.length >= 2) return { from: dates[0]!, to: dates[dates.length - 1]! };
    if (dates.length === 1) return { from: dates[0]!, to: dates[0]! };
  }
  const dotted = [...q.matchAll(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/g)];
  const found: string[] = [];
  for (const m of dotted) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    if (y < 100) y += 2000;
    const value = ymdOf(y, month, day);
    if (value) found.push(value);
  }
  if (found.length >= 2) {
    const sorted = found.sort();
    return { from: sorted[0]!, to: sorted[sorted.length - 1]! };
  }
  if (found.length === 1) return { from: found[0]!, to: found[0]! };
  return undefined;
}

function extractRelative(q: string, today: string): DatePeriod | undefined {
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("o'tgan yil", "otgan yil", "прошлый год", "прошлом году", "o'tgan yilda")) {
    const y = Number(today.slice(0, 4)) - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (has("shu yil", "bu yil", "этот год", "в этом году", "joriy yil", "yil boshidan")) {
    return { from: yearStart(today), to: today };
  }
  if (has("o'tgan chorak", "otgan chorak", "прошлый квартал", "прошлом квартале")) {
    const start = quarterStart(today);
    const prevEnd = addDays(start, -1);
    return { from: quarterStart(prevEnd), to: prevEnd };
  }
  if (has("shu chorak", "bu chorak", "chorak", "квартал", "в этом квартале")) {
    return { from: quarterStart(today), to: today };
  }
  if (has("o'tgan oy", "otgan oy", "прошлый месяц", "прошлом месяце", "o'tgan oyda")) {
    const prevEnd = addDays(monthStart(today), -1);
    return { from: monthStart(prevEnd), to: monthEnd(prevEnd) };
  }
  if (has("shu oy", "bu oy", "oy boshidan", "joriy oy", "этот месяц", "в этом месяце", "текущий месяц", "oylik")) {
    return { from: monthStart(today), to: today };
  }
  if (has("o'tgan hafta", "otgan hafta", "прошлая неделя", "прошлой неделе", "o'tgan haftada")) {
    const prevEnd = addDays(weekStart(today), -1);
    return { from: weekStart(prevEnd), to: prevEnd };
  }
  if (has("shu hafta", "bu hafta", "hafta boshidan", "эта неделя", "на этой неделе", "текущая неделя", "haftalik")) {
    return { from: weekStart(today), to: today };
  }
  if (has("kecha", "вчера", "kechagi")) {
    const day = addDays(today, -1);
    return { from: day, to: day };
  }
  if (has("bugun", "сегодня", "bugungi")) {
    return { from: today, to: today };
  }
  return undefined;
}

function extractNamedMonth(q: string, year: number, today: string): DatePeriod | undefined {
  const range = q.match(
    new RegExp(`\\b(\\d{1,2})\\s*(?:-|–|—|dan|gacha|по|до|to)\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`)
  );
  if (range) {
    const month = monthIndexByName(range[3]!);
    if (month) {
      const from = ymdOf(year, month, Number(range[1]));
      const to = ymdOf(year, month, Number(range[2]));
      if (from && to) return { from: from <= to ? from : to, to: from <= to ? to : from };
    }
  }
  const single = q.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`));
  if (single) {
    const month = monthIndexByName(single[2]!);
    if (month) {
      const day = ymdOf(year, month, Number(single[1]));
      if (day) return { from: day, to: day };
    }
  }
  const monthOnly = q.match(new RegExp(`\\b(${MONTH_PATTERN})\\b`));
  if (monthOnly) {
    const month = monthIndexByName(monthOnly[1]!);
    if (month) {
      const from = ymdOf(year, month, 1);
      if (from) {
        const end = monthEnd(from);
        // Kelajakdagi oy so‘ralmasin — bugungi kungacha kesamiz.
        return { from, to: end > today ? today : end };
      }
    }
  }
  return undefined;
}

function extractLastDays(q: string, today: string): DatePeriod | undefined {
  const match = q.match(/(?:oxirgi|so'nggi|songgi|последн\w*|за)\s*(\d{1,3})\s*(?:kun|дн\w*|day)/);
  if (!match) return undefined;
  const days = Math.min(366, Math.max(1, Number(match[1])));
  return { from: addDays(today, -(days - 1)), to: today };
}

/** Jadval sarlavhasi uchun qisqa davr: `01.11 — 12.11.2026` */
export function formatPeriodLabel(period?: { from?: string; to?: string }): string {
  if (!period?.from && !period?.to) return "";
  const from = period.from ?? period.to!;
  const to = period.to ?? period.from!;
  if (from === to) return formatDay(from);
  return `${formatDay(from)} — ${formatDay(to)}`;
}

export function formatDay(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(0, 4)}`;
}
