/** Mobil maydon rollari (agent, expeditor, supervisor). */
export const MOBILE_FIELD_ROLE_NAMES = ["agent", "expeditor", "supervisor"] as const;
export type MobileFieldRole = (typeof MOBILE_FIELD_ROLE_NAMES)[number];

export const MOBILE_FIELD_ROLES = new Set<string>(MOBILE_FIELD_ROLE_NAMES);

export function isMobileFieldRole(role: string): role is MobileFieldRole {
  return MOBILE_FIELD_ROLES.has(role);
}

/** Umumiy JSON body limiti (foto marshrutlari alohida kattaroq). */
export const GLOBAL_HTTP_BODY_LIMIT_BYTES = 5 * 1024 * 1024;
