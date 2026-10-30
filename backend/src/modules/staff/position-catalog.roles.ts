/**
 * «Должности» katalogidagi tizim rollari (User.role) — screenshot / forma dropdown.
 * To‘liq JWT rollar emas: lavozim bog‘lanishi uchun asosiy staff turlari.
 */
export const POSITION_CATALOG_ROLE_OPTIONS = [
  { value: "agent", label_ru: "Агент", label_uz: "Agent" },
  { value: "operator", label_ru: "Офисный работник", label_uz: "Ofis xodimi" },
  { value: "cashier", label_ru: "Кассир", label_uz: "Kassir" },
  { value: "supervisor", label_ru: "Супервайзеры", label_uz: "Supervayzer" },
  { value: "manager", label_ru: "Менеджер", label_uz: "Menejer" },
  { value: "expeditor", label_ru: "Экспедитор", label_uz: "Ekspeditor" },
  { value: "merchandiser", label_ru: "Мерчендайзер", label_uz: "Merchendayzer" },
  { value: "collector", label_ru: "Инкассатор", label_uz: "Inkassator" },
  { value: "auditor", label_ru: "Аудитор", label_uz: "Auditor" },
  { value: "skladchik", label_ru: "Складчик", label_uz: "Omborchi" },
  { value: "director", label_ru: "Директор", label_uz: "Direktor" },
  { value: "accountant", label_ru: "Бухгалтер", label_uz: "Buxgalter" }
] as const;

export type PositionCatalogRole = (typeof POSITION_CATALOG_ROLE_OPTIONS)[number]["value"];

const ROLE_SET = new Set<string>(POSITION_CATALOG_ROLE_OPTIONS.map((o) => o.value));

export function isPositionCatalogRole(role: string | null | undefined): role is PositionCatalogRole {
  return role != null && ROLE_SET.has(role.trim());
}

export function positionCatalogRoleLabelRu(role: string | null | undefined): string {
  if (!role) return "—";
  const hit = POSITION_CATALOG_ROLE_OPTIONS.find((o) => o.value === role);
  return hit?.label_ru ?? role;
}
