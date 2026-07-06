/** Veb «Доступ» — mobil-only KOMANDA rollari (agent, expeditor, collector, auditor). */
export const MOBILE_ONLY_KOMANDA_ROLES = ["agent", "expeditor", "collector", "auditor"] as const;

export function isMobileOnlyKomandaRole(role: string): boolean {
  return (MOBILE_ONLY_KOMANDA_ROLES as readonly string[]).includes(role.trim());
}

export function isExcludedFromAccessWebUsersList(role: string): boolean {
  return isMobileOnlyKomandaRole(role);
}

export function filterAccessWebPanelUsers<T extends { role: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isExcludedFromAccessWebUsersList(r.role));
}

export function isActiveAccessWebUser(u: { status?: string; is_active?: boolean }): boolean {
  if (typeof u.is_active === "boolean") return u.is_active;
  return u.status === "active";
}

/** Ruxsat biriktirish modallari va «Операции/кассы…» jadvali — faqat faol web-panel foydalanuvchilari. */
export function filterAccessWebAssignableUsers<
  T extends { role: string; status?: string; is_active?: boolean }
>(rows: T[]): T[] {
  return rows.filter((r) => !isExcludedFromAccessWebUsersList(r.role) && isActiveAccessWebUser(r));
}
