/**
 * Veb-panel `User.role` — backend `OPERATOR_LIKE_WEB_ROLES` bilan mos.
 * (Ruxsat matritsasi keyin; bu yerda faqat ko‘rsatish / forma.)
 */
export const WEB_PANEL_ACCESS_ROLE_OPTIONS = [
  { value: "operator", label: "Operator" },
  { value: "director", label: "Direktor" },
  { value: "sales_director", label: "Savdo direktori" },
  { value: "manager", label: "Menejer" },
  { value: "regional_manager", label: "Regional menejer" },
  { value: "accountant", label: "Buxgalter" },
  { value: "warehouse_manager", label: "Ombor menejeri" }
] as const;

export const WEB_ACCESS_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  WEB_PANEL_ACCESS_ROLE_OPTIONS.map((o) => [o.value, o.label])
);

const OPERATOR_LIKE_SET = new Set<string>(WEB_PANEL_ACCESS_ROLE_OPTIONS.map((o) => o.value));

/** JWT `role` — backend `OPERATOR_LIKE_WEB_ROLES` (admin alohida). */
export function isOperatorLikeWebRole(role: string | null | undefined): boolean {
  return role != null && OPERATOR_LIKE_SET.has(role);
}

export function isAdminOrOperatorLikeRole(role: string | null | undefined): boolean {
  return role === "admin" || isOperatorLikeWebRole(role);
}
