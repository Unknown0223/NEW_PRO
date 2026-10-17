import type { TgButtonStyle, TgInlineButton, TgInlineKeyboard } from "./tg-api";

/** Telegram `callback_data` cheklovi — 64 bayt. */
export const CB_MAX_BYTES = 64;

export function cb(...parts: Array<string | number>): string {
  const s = parts.map((p) => String(p).replace(/:/g, "")).join(":");
  if (Buffer.byteLength(s, "utf8") > CB_MAX_BYTES) throw new Error(`callback_data too long: ${s}`);
  return s;
}

export function parseCb(data: string | undefined): string[] {
  if (!data || Buffer.byteLength(data, "utf8") > CB_MAX_BYTES) return [];
  return data.split(":");
}

export function btn(text: string, data: string, style?: TgButtonStyle, iconCustomEmojiId?: string): TgInlineButton {
  return {
    text,
    callback_data: data,
    ...(style ? { style } : {}),
    ...(iconCustomEmojiId ? { icon_custom_emoji_id: iconCustomEmojiId } : {})
  };
}

export function urlBtn(text: string, url: string, style?: TgButtonStyle): TgInlineButton {
  return { text, url, ...(style ? { style } : {}) };
}

export function kb(...rows: Array<TgInlineButton[] | null | undefined | false>): TgInlineKeyboard {
  return { inline_keyboard: rows.filter((r): r is TgInlineButton[] => Array.isArray(r) && r.length > 0) };
}

/** Tugmalarni `perRow` tadan qatorlarga bo'lish. */
export function grid(buttons: TgInlineButton[], perRow = 2): TgInlineButton[][] {
  const out: TgInlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow));
  return out;
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function money(v: unknown, currency = "so'm"): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return `0 ${currency}`;
  const abs = Math.round(Math.abs(n));
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "−" : ""}${s} ${currency}`.trim();
}

export function num(v: unknown, digits = 0): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(digits);
  const [i, f] = fixed.split(".");
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${f && Number(f) !== 0 ? "," + f : ""}`;
}

/** Ish hududi vaqti (Toshkent, UTC+5). */
export const WORK_TZ_OFFSET_MIN = 300;

function shift(d: Date): Date {
  return new Date(d.getTime() + WORK_TZ_OFFSET_MIN * 60000);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = shift(new Date(d));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(x.getUTCDate())}.${p(x.getUTCMonth() + 1)}.${x.getUTCFullYear()}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = shift(new Date(d));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fmtDate(d)} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
}

/** Ish hududidagi bugungi sana `YYYY-MM-DD`. */
export function todayYmd(now = new Date()): string {
  return shift(now).toISOString().slice(0, 10);
}

export function localHour(now = new Date()): number {
  return shift(now).getUTCHours();
}

export function ymdToUtcStart(ymd: string): Date {
  return new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() - WORK_TZ_OFFSET_MIN * 60000);
}

export function ymdToUtcEnd(ymd: string): Date {
  return new Date(ymdToUtcStart(ymd).getTime() + 86400000 - 1);
}

export type PeriodKey = "tm" | "pm" | "30" | "90" | "ty";

/** Davr kaliti → [from, to] (YYYY-MM-DD, ish hududi bo'yicha). */
export function periodRange(key: string, now = new Date()): { from: string; to: string } {
  const today = todayYmd(now);
  const [y, m] = today.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (key) {
    case "pm": {
      const from = new Date(Date.UTC(y, m - 2, 1));
      const to = new Date(Date.UTC(y, m - 1, 0));
      return { from: iso(from), to: iso(to) };
    }
    case "30":
    case "90": {
      const days = Number(key);
      const from = new Date(new Date(`${today}T00:00:00.000Z`).getTime() - (days - 1) * 86400000);
      return { from: iso(from), to: today };
    }
    case "ty":
      return { from: `${y}-01-01`, to: today };
    case "tm":
    default:
      return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
  }
}

export const ORDER_STATUS_EMOJI: Record<string, string> = {
  new: "🆕",
  pending_sync: "⏳",
  confirmed: "✅",
  picking: "📦",
  picked: "📦",
  delivering: "🚚",
  delivered: "✔️",
  returned: "↩️",
  partially_returned: "↩️",
  cancelled: "❌"
};

export function statusEmoji(status: string): string {
  return ORDER_STATUS_EMOJI[status] ?? "•";
}

/** Sahifalash tugmalari: ◀️ 2/5 ▶️ */
export function pagerRow(prefix: string, page: number, pages: number): TgInlineButton[] {
  if (pages <= 1) return [];
  const row: TgInlineButton[] = [];
  if (page > 1) row.push(btn("◀️", `${prefix}:${page - 1}`));
  row.push(btn(`${page}/${pages}`, "noop"));
  if (page < pages) row.push(btn("▶️", `${prefix}:${page + 1}`));
  return row;
}

/** Mijoz nomini qisman yashirish: «Baraka Savdo» → «Ba**** Sa***». */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w : w.slice(0, 2) + "*".repeat(Math.min(w.length - 2, 6))))
    .join(" ");
}

/** Telefon → oxirgi 9 raqam (O'zbekiston formatini solishtirish uchun). */
export function phoneKey(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 9) return null;
  return d.slice(-9);
}

/** Matnni Telegram 4096 belgi chegarasiga sig'dirish. */
export function clip(text: string, max = 3900): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/** Progress bar: ▓▓▓▓░░░░ 52% */
export function bar(pct: number, width = 10): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const full = Math.round((p / 100) * width);
  return `${"▓".repeat(full)}${"░".repeat(width - full)} ${p}%`;
}
