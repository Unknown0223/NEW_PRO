/**
 * Veb-panel `User.role` — backend `OPERATOR_LIKE_WEB_ROLES` bilan mos.
 * (Ruxsat matritsasi keyin; bu yerda faqat ko‘rsatish / forma.)
 */
export const WEB_PANEL_ACCESS_ROLE_OPTIONS = [
  { value: "operator", label: "Оператор" },
  { value: "director", label: "Директор" },
  { value: "sales_director", label: "Коммерческий директор" },
  { value: "manager", label: "Менеджер" },
  { value: "regional_manager", label: "Региональный менеджер" },
  { value: "accountant", label: "Бухгалтер" },
  { value: "warehouse_manager", label: "Заведующий складом" }
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
