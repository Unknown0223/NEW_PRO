import { MOBILE_FIELD_ROLE_NAMES } from "../../lib/constants";

/**
 * `app_access=false` bo‘lganda login / refresh / /me / JWT marshrutlari bloklanadi.
 * Admin mustasno. Operator/skladchik da flag «Mobil ilova» (default false) — web login uchun
 * shu to‘plamga kiritilmaydi (web staff create default app_access=false).
 */
export const APP_ACCESS_ENFORCED_ROLE_NAMES = [
  ...MOBILE_FIELD_ROLE_NAMES,
  "collector",
  "auditor"
] as const;

export const APP_ACCESS_ENFORCED_ROLES = new Set<string>(APP_ACCESS_ENFORCED_ROLE_NAMES);

export function isAppAccessEnforcedRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return APP_ACCESS_ENFORCED_ROLES.has(role);
}

/** Foydalanuvchiga ko‘rsatiladigan xabar (RU + UZ). */
export const APP_ACCESS_DENIED_MESSAGE =
  "Доступ к приложению отключён / Ilova kirish o‘chirilgan. Обратитесь к администратору.";

export function assertAppAccessAllowed(role: string, appAccess: boolean | null | undefined): void {
  if (isAppAccessEnforcedRole(role) && appAccess === false) {
    throw new Error("APP_ACCESS_DENIED");
  }
}
