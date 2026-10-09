import { WEB_ACCESS_ROLE_LABELS } from "@/lib/distribution-roles";

const EXTRA_ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  supervisor: "Супервайзер",
  agent: "Агент",
  expeditor: "Экспедитор",
  collector: "Инкассатор",
  auditor: "Аудитор",
  storekeeper: "Складчик",
  skladchik: "Складчик"
};

export function accessRoleLabel(role: string | null | undefined): string {
  const r = (role ?? "").trim();
  if (!r) return "Без роли";
  return WEB_ACCESS_ROLE_LABELS[r] ?? EXTRA_ROLE_LABELS[r] ?? r;
}
