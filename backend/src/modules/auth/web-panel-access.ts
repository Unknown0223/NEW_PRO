import { isWebPanelDeniedRole } from "../../lib/tenant-user-roles";

export { isWebPanelDeniedRole };

export const WEB_ACCESS_DENIED = "WEB_ACCESS_DENIED";

export const WEB_ACCESS_DENIED_MESSAGE =
  "Этот аккаунт работает только в мобильном приложении. Веб-панель недоступна.";

/** Brauzer (veb-panel) so‘rovi — Origin yoki Mozilla UA; Flutter/Dart emas. */
export function isBrowserWebRequest(headers: {
  origin?: string;
  "user-agent"?: string;
}): boolean {
  if (headers.origin?.trim()) return true;
  const ua = headers["user-agent"] ?? "";
  if (/Dart\/|okhttp|Flutter/i.test(ua)) return false;
  return /Mozilla|Chrome|Safari|Firefox|Edg\//i.test(ua);
}

/** Login tanasi: ilova `apk_version` yuboradi, veb forma yubormaydi. */
export function isMobileAppLogin(input: { apk_version?: string | null }): boolean {
  return Boolean(input.apk_version?.trim());
}

export function assertWebPanelLoginAllowed(
  role: string,
  input: { apk_version?: string | null }
): void {
  if (isWebPanelDeniedRole(role) && !isMobileAppLogin(input)) {
    throw new Error(WEB_ACCESS_DENIED);
  }
}

export function assertWebPanelBrowserAllowed(role: string, headers: {
  origin?: string;
  "user-agent"?: string;
}): void {
  if (isWebPanelDeniedRole(role) && isBrowserWebRequest(headers)) {
    throw new Error(WEB_ACCESS_DENIED);
  }
}
