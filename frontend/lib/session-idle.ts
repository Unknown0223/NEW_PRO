/**
 * Veb sessiya qoidalari:
 * - faolsizlik: 15 daqiqa; «Запомнить» bo‘lsa 1 soat;
 * - qat’iy maksimal: login dan 1 soat (30 kunlik eslab qolish yo‘q).
 */

export const IDLE_TIMEOUT_DEFAULT_MS = 15 * 60 * 1000;
export const IDLE_TIMEOUT_REMEMBER_MS = 60 * 60 * 1000;
/** Login oilasi / brauzer sessiya — hech qachon 1 soatdan oshmaydi. */
export const SESSION_ABSOLUTE_MAX_MS = 60 * 60 * 1000;

const PREF_KEY = "salec:login-remember";
const STARTED_KEY = "salec:session-started-at";

export function idleTimeoutMs(remember: boolean): number {
  return remember ? IDLE_TIMEOUT_REMEMBER_MS : IDLE_TIMEOUT_DEFAULT_MS;
}

/** Login dan keyin qaytish uchun xavfsiz ichki yo‘l (`/login`, `//…` rad). */
export function safePostLoginPath(from: string | null | undefined): string {
  const raw = (from ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login/") || raw.startsWith("/login?")) {
    return "/dashboard";
  }
  return raw;
}

/** Idle / sessiya tugaganda login URL — oxirgi sahifa `from` da. */
export function loginUrlWithReturn(pathname: string, search = ""): string {
  const current = `${pathname}${search}`;
  const from = safePostLoginPath(current);
  const params = new URLSearchParams({ from });
  return `/login?${params.toString()}`;
}

export function readRememberLoginPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(PREF_KEY);
    if (v == null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function writeRememberLoginPreference(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, remember ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function currentIdleTimeoutMs(): number {
  return idleTimeoutMs(readRememberLoginPreference());
}

/** Birinchi marta sessiya ochilganda yoziladi; refresh qayta yozmaydi. */
export function markWebSessionStarted(now = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(STARTED_KEY) != null) return;
    window.localStorage.setItem(STARTED_KEY, String(now));
  } catch {
    /* ignore */
  }
}

export function clearWebSessionStarted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STARTED_KEY);
  } catch {
    /* ignore */
  }
}

export function isWebSessionAbsoluteExpired(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STARTED_KEY);
    if (raw == null) return false;
    const started = Number(raw);
    if (!Number.isFinite(started)) return false;
    return now - started >= SESSION_ABSOLUTE_MAX_MS;
  } catch {
    return false;
  }
}
