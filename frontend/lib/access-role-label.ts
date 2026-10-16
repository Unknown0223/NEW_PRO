import { WEB_ACCESS_ROLE_LABELS } from "@/lib/distribution-roles";

const EXTRA_ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  supervisor: "Супервайзер",
  agent: "Агент",
  expeditor: "Экспедитор",
  collector: "Инкассатор",
  auditor: "Аудитор",
  storekeeper: "Кладовщик",
  skladchik: "Складчик",
  cashier: "Кассир",
  gruzchik: "Грузчик",
  logist: "Логист",
  merchandiser: "Мерчендайзер",
  driver: "Водитель",
  dispatcher: "Диспетчер",
  partner: "Партнёр",
  warehouse: "Складчик",
  commercial_director: "Коммерческий директор",
  vansell: "Ван-селлинг",
  vanseller: "Ван-селлинг",
  van_seller: "Ван-селлинг"
};

export function accessRoleLabel(role: string | null | undefined): string {
  const r = (role ?? "").trim();
  if (!r) return "Без роли";
  const key = r.toLowerCase();
  return WEB_ACCESS_ROLE_LABELS[key] ?? EXTRA_ROLE_LABELS[key] ?? r;
}

/** Bazadagi nom kalitning o‘zi bo‘lsa — interfeys tilidagi nom. O‘zgartirilgan nom saqlanadi. */
export function accessRoleDisplayName(key: string | null | undefined, storedName?: string | null): string {
  const k = (key ?? "").trim();
  const stored = (storedName ?? "").trim();
  const rawKey = !stored || stored.toLowerCase() === k.toLowerCase() || /^[a-z0-9_]+$/i.test(stored);
  if (!rawKey) return stored;
  return accessRoleLabel(k || stored);
}
