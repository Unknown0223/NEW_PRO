/**
 * Sessiya TTL:
 * - Web: qat’iy maksimal 1 soat (idle 15 daqiqa / «Запомнить» 1 soat — frontend).
 * - Mobile (APK): 30 kun, refresh da slide (absolute 1 soat web qoidasi mobilga qo‘llanilmaydi).
 */

export const WEB_REFRESH_TOKEN_TTL_MS = 60 * 60 * 1000;
export const MOBILE_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** @deprecated — web cookie; mobil body refresh cookie ishlatmaydi */
export const REFRESH_TOKEN_TTL_MS = WEB_REFRESH_TOKEN_TTL_MS;
export const REFRESH_COOKIE_MAX_AGE_SEC = Math.floor(WEB_REFRESH_TOKEN_TTL_MS / 1000);

/** Login da mobil sessiyaga yoziladi; refresh da platform aniqlash uchun. */
export const MOBILE_SESSION_UA_PREFIX = "SalecMobile/";

export type SessionClientKind = "web" | "mobile";

export function sessionClientKindFromApk(apkVersion: string | null | undefined): SessionClientKind {
  return apkVersion?.trim() ? "mobile" : "web";
}

export function isMobileSessionUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.startsWith(MOBILE_SESSION_UA_PREFIX));
}

export function refreshTtlMs(kind: SessionClientKind): number {
  return kind === "mobile" ? MOBILE_REFRESH_TOKEN_TTL_MS : WEB_REFRESH_TOKEN_TTL_MS;
}

export function refreshExpiresAt(fromMs = Date.now(), kind: SessionClientKind = "web"): Date {
  return new Date(fromMs + refreshTtlMs(kind));
}

/** Mobil login user_agent — refresh da web 1 soat absolute dan farqlash. */
export function mobileSessionUserAgent(
  apkVersion: string,
  rawUserAgent: string | null | undefined
): string {
  const apk = apkVersion.trim().slice(0, 64) || "unknown";
  const rest = (rawUserAgent ?? "").trim();
  const combined = rest ? `${MOBILE_SESSION_UA_PREFIX}${apk}; ${rest}` : `${MOBILE_SESSION_UA_PREFIX}${apk}`;
  return combined.slice(0, 512);
}
