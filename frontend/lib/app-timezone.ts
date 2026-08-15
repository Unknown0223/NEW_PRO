/** Ish mintaqasi — default O‘zbekiston (UTC+5). Tenant sozlamasidan yangilanadi. */
export const DEFAULT_APP_TIMEZONE = "Asia/Tashkent";

let _appTimezone = DEFAULT_APP_TIMEZONE;

/** Joriy display / format timezone (IANA). */
export function getAppTimezone(): string {
  return _appTimezone;
}

/** Profil yuklanganda yoki sozlamalar saqlanganda. */
export function setAppTimezone(iana: string | null | undefined): void {
  const t = typeof iana === "string" ? iana.trim() : "";
  _appTimezone = t || DEFAULT_APP_TIMEZONE;
}

/** Orqaga moslik — import qilgan joylar `APP_TIMEZONE` o‘qiydi. */
export const APP_TIMEZONE = DEFAULT_APP_TIMEZONE;

export type AppTzParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

/**
 * ISO / Date → ish mintaqasi qismlari.
 * Server (UTC) va brauzer TZ farqida bir xil natija.
 */
export function partsInAppTz(iso: string | Date | null | undefined): AppTzParts | null {
  if (iso == null || iso === "") return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: getAppTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  let hour = map.hour ?? "00";
  // ba'zi engine: midnight → "24"
  if (hour === "24") hour = "00";

  return {
    year: map.year ?? "0000",
    month: map.month ?? "01",
    day: map.day ?? "01",
    hour,
    minute: map.minute ?? "00",
    second: map.second ?? "00"
  };
}

/** `24.05 17:19` */
export function formatAppDateTimeShort(iso: string | Date | null | undefined): string {
  const p = partsInAppTz(iso);
  if (!p) return "";
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

/** `25.05.2026 16:17` */
export function formatAppDateTime(iso: string | Date | null | undefined, empty = "—"): string {
  const p = partsInAppTz(iso);
  if (!p) return empty;
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** `25.05.2026 15:55:24` */
export function formatAppDateTimeFull(iso: string | Date | null | undefined, empty = ""): string {
  const p = partsInAppTz(iso);
  if (!p) return empty;
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** `25.05.2026` */
export function formatAppDate(iso: string | Date | null | undefined, empty = "—"): string {
  const p = partsInAppTz(iso);
  if (!p) return empty;
  return `${p.day}.${p.month}.${p.year}`;
}

/** `toLocaleString` uchun umumiy opts — har chaqiruvda joriy TZ. */
export function appTzLocaleOpts(): Intl.DateTimeFormatOptions {
  return {
    timeZone: getAppTimezone(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
}

/** Orqaga moslik (static obyekt — eski importlar). Prefer `appTzLocaleOpts()`. */
export const APP_TZ_LOCALE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: DEFAULT_APP_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
};
