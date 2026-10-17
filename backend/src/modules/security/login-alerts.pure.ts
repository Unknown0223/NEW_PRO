export const LOGIN_ALERT_KINDS = ["shared_device", "concurrent_devices", "new_device", "shared_ip"] as const;
export type LoginAlertKind = (typeof LOGIN_ALERT_KINDS)[number];

export const LOGIN_ALERT_RISKS = ["high", "medium", "low"] as const;
export type LoginAlertRisk = (typeof LOGIN_ALERT_RISKS)[number];

export const LOGIN_ALERT_STATUSES = ["open", "ok", "confirmed"] as const;
export type LoginAlertStatus = (typeof LOGIN_ALERT_STATUSES)[number];

export type LoginPlatform = "web" | "mobile";

/** Bitta qurilmadan boshqa akkauntlar qidiriladigan davr. */
export const SHARED_DEVICE_WINDOW_DAYS = 30;
/** Bitta IP dan «bir vaqtda» deb hisoblanadigan oraliq. */
export const SHARED_IP_WINDOW_MINUTES = 10;
/** `details.events` da saqlanadigan oxirgi kirishlar soni. */
export const ALERT_EVENTS_KEEP = 30;

export function platformOfLogin(apkVersion: string | null | undefined): LoginPlatform {
  return apkVersion && apkVersion.trim() ? "mobile" : "web";
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

/** `::ffff:1.2.3.4` → `1.2.3.4`; bo'sh joylarsiz. */
export function normalizeIp(ip: string | null | undefined): string | null {
  const s = ip?.trim().toLowerCase();
  if (!s) return null;
  return s.startsWith("::ffff:") && ipv4ToInt(s.slice(7)) != null ? s.slice(7) : s;
}

/** Ichki tarmoq / localhost — umumiy IP qoidasi uchun ma'nosiz. */
export function isPrivateIp(ip: string | null | undefined): boolean {
  const s = normalizeIp(ip);
  if (!s) return true;
  if (s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80")) return true;
  const n = ipv4ToInt(s);
  if (n == null) return false;
  const a = Math.floor(n / 16777216);
  const b = Math.floor(n / 65536) % 256;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Oq ro'yxat yozuvi: aniq IP yoki IPv4 CIDR. Noto'g'ri bo'lsa `null`. */
export function normalizeWhitelistEntry(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const [addr, bitsRaw, extra] = s.split("/");
  if (extra !== undefined || !addr) return null;
  if (bitsRaw === undefined) {
    if (ipv4ToInt(addr) != null) return addr;
    return /^[0-9a-f:]+$/.test(addr) && addr.includes(":") ? addr : null;
  }
  if (!/^\d{1,2}$/.test(bitsRaw)) return null;
  const bits = Number(bitsRaw);
  if (bits < 8 || bits > 32 || ipv4ToInt(addr) == null) return null;
  return `${addr}/${bits}`;
}

export function ipMatchesWhitelist(ip: string | null | undefined, entries: readonly string[]): boolean {
  const s = normalizeIp(ip);
  if (!s) return false;
  const n = ipv4ToInt(s);
  for (const e of entries) {
    const [addr, bitsRaw] = e.split("/");
    if (bitsRaw === undefined) {
      if (addr === s) return true;
      continue;
    }
    const base = ipv4ToInt(addr ?? "");
    if (n == null || base == null) continue;
    const block = 2 ** (32 - Number(bitsRaw));
    if (Math.floor(n / block) === Math.floor(base / block)) return true;
  }
  return false;
}

export function mergeUserIds(a: readonly number[], b: readonly number[]): number[] {
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}

export type AlertDecision = "create" | "merge" | "touch" | "reopen";

/**
 * Ochiq ogohlantirish — yangi akkauntlar qo'shiladi. Ko'rib chiqilgan («норма» / «нарушение»)
 * — o'sha akkauntlar bo'lsa faqat vaqt yangilanadi, yangi akkaunt paydo bo'lsa qayta ochiladi.
 */
export function decideAlertUpdate(
  existing: { status: string; user_ids: readonly number[] } | null,
  incomingUserIds: readonly number[]
): AlertDecision {
  if (!existing) return "create";
  if (existing.status === "open") return "merge";
  const known = new Set(existing.user_ids);
  return incomingUserIds.every((id) => known.has(id)) ? "touch" : "reopen";
}

/** Toshkent kuni (`YYYY-MM-DD`) — IP ogohlantirishlari kun bo'yicha guruhlanadi. */
export function tashkentDay(d: Date): string {
  return new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

export const LOGIN_ALERT_KIND_RU: Record<LoginAlertKind, string> = {
  shared_device: "Одно устройство — несколько аккаунтов",
  concurrent_devices: "Аккаунт одновременно на двух телефонах",
  new_device: "Вход с нового устройства",
  shared_ip: "Один IP — несколько аккаунтов"
};

export function pushAlertEvent<T>(events: readonly T[], ev: T): T[] {
  return [...events, ev].slice(-ALERT_EVENTS_KEEP);
}
