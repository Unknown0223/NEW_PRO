/**
 * Brauzer sessiyasi: localStorage (savdo-auth) + middleware cookie (sd_auth).
 */

export const AUTH_STORAGE_KEY = "savdo-auth";
export const AUTH_COOKIE_NAME = "sd_auth";
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24;

function authCookieFlags(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? ";Secure" : "";
  return `;path=/;max-age=${AUTH_COOKIE_MAX_AGE_SEC};SameSite=Strict${secure}`;
}

export function setAuthSessionFlagCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=1${authCookieFlags()}`;
}

export function clearAuthSessionFlagCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=;path=/;max-age=0;SameSite=Strict`;
}

export function syncAuthToCookie(): void {
  setAuthSessionFlagCookie();
}
