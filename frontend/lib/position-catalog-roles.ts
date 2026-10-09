/**
 * Frontend mirror — backend `position-catalog.roles.ts` bilan sinxron.
 */
export const POSITION_CATALOG_ROLE_OPTIONS = [
  { value: "agent", label: "Агент" },
  { value: "operator", label: "Офисный работник" },
  { value: "cashier", label: "Кассир" },
  { value: "supervisor", label: "Супервайзеры" },
  { value: "manager", label: "Менеджер" },
  { value: "expeditor", label: "Экспедитор" },
  { value: "merchandiser", label: "Мерчендайзер" },
  { value: "collector", label: "Инкассатор" },
  { value: "auditor", label: "Аудитор" },
  { value: "skladchik", label: "Складчик" },
  { value: "director", label: "Директор" },
  { value: "accountant", label: "Бухгалтер" }
] as const;

export type PositionCatalogRole = (typeof POSITION_CATALOG_ROLE_OPTIONS)[number]["value"];

const ROLE_SET = new Set<string>(POSITION_CATALOG_ROLE_OPTIONS.map((o) => o.value));

export function isPositionCatalogRole(role: string | null | undefined): role is PositionCatalogRole {
  return role != null && ROLE_SET.has(role.trim());
}

export function positionCatalogRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  const hit = POSITION_CATALOG_ROLE_OPTIONS.find((o) => o.value === role);
  return hit?.label ?? role;
}
