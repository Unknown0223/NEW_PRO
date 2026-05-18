/**
 * Brauzer sessiyasi: localStorage (savdo-auth) + middleware cookie (sd_auth).
 */

export const AUTH_STORAGE_KEY = "savdo-auth";
export const AUTH_COOKIE_NAME = "sd_auth";
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24;

export function setAuthSessionFlagCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=1;path=/;max-age=${AUTH_COOKIE_MAX_AGE_SEC};SameSite=Lax`;
}

export function clearAuthSessionFlagCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=;path=/;max-age=0`;
}

export function syncAuthToCookie(): void {
  setAuthSessionFlagCookie();
}
