import { prisma } from "../../config/database";
import { asRecord } from "./tenant-settings.shared";

/** Standart ish mintaqasi (O‘zbekiston). */
export const DEFAULT_TENANT_TIMEZONE = "Asia/Tashkent";

export type TenantTimezoneOption = {
  id: string;
  label: string;
  /** Taxminiy UTC ofset (soat); DST bo‘lmagan mintaqalar uchun aniq. */
  utc_offset_hours: number;
};

/** Admin UI: har qanday haqiqiy IANA; ro‘yxat faqat UI uchun namunalar. */
export const TENANT_TIMEZONE_OPTIONS: TenantTimezoneOption[] = [
  { id: "Asia/Tashkent", label: "Узбекистан (UTC+5) — Ташкент", utc_offset_hours: 5 },
  { id: "Asia/Samarkand", label: "Узбекистан (UTC+5) — Самарканд", utc_offset_hours: 5 },
  { id: "Asia/Almaty", label: "Казахстан (UTC+5) — Алматы", utc_offset_hours: 5 },
  { id: "Asia/Aqtobe", label: "Казахстан (UTC+5) — Актобе", utc_offset_hours: 5 },
  { id: "Asia/Bishkek", label: "Кыргызстан (UTC+6) — Бишкек", utc_offset_hours: 6 },
  { id: "Asia/Dushanbe", label: "Таджикистан (UTC+5) — Душанбе", utc_offset_hours: 5 },
  { id: "Asia/Ashgabat", label: "Туркменистан (UTC+5) — Ашхабад", utc_offset_hours: 5 },
  { id: "Asia/Dubai", label: "ОАЭ (UTC+4) — Дубай", utc_offset_hours: 4 },
  { id: "Asia/Yekaterinburg", label: "Россия (UTC+5) — Екатеринбург", utc_offset_hours: 5 },
  { id: "Asia/Novosibirsk", label: "Россия (UTC+7) — Новосибирск", utc_offset_hours: 7 },
  { id: "Europe/Moscow", label: "Россия (UTC+3) — Москва", utc_offset_hours: 3 },
  { id: "Europe/Istanbul", label: "Турция (UTC+3) — Стамбул", utc_offset_hours: 3 },
  { id: "UTC", label: "UTC (UTC+0)", utc_offset_hours: 0 }
];

function isValidIanaTimezone(id: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

/** Sozlamalardan IANA timezone — noto‘g‘ri bo‘lsa default. */
export function normalizeTenantTimezone(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_TENANT_TIMEZONE;
  const id = raw.trim();
  if (!id || id.length > 64) return DEFAULT_TENANT_TIMEZONE;
  if (!isValidIanaTimezone(id)) return DEFAULT_TENANT_TIMEZONE;
  return id;
}

/**
 * Berilgan instant uchun UTC ofset (soat, kasr bo‘lishi mumkin).
 * DST bo‘lsa joriy ofset; aks holda catalog qiymati.
 */
export function utcOffsetHoursForTimezone(
  timeZone: string,
  instant: Date = new Date()
): number {
  const known = TENANT_TIMEZONE_OPTIONS.find((o) => o.id === timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(instant);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // "GMT+5", "GMT+05:00", "UTC+5"
    const m = tzName.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      const h = Number(m[2]);
      const mins = m[3] != null ? Number(m[3]) : 0;
      if (Number.isFinite(h) && Number.isFinite(mins)) {
        return sign * (h + mins / 60);
      }
    }
  } catch {
    /* fall through */
  }
  return known?.utc_offset_hours ?? 5;
}

export function loadTimezoneFromSettingsJson(settings: unknown): string {
  return normalizeTenantTimezone(asRecord(settings).timezone);
}

export async function loadTenantTimezone(tenantId: number): Promise<string> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  return loadTimezoneFromSettingsJson(row?.settings);
}

export type TenantTimezoneDto = {
  timezone: string;
  utc_offset_hours: number;
  options: TenantTimezoneOption[];
};
