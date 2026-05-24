/**
 * RU labels for the Access UI «Родитель» column (sidebar-aligned), without changing DB `module` keys.
 */
export const MODULE_PARENT_LABEL_RU: Record<string, string> = {
  dashboard: "Дашборд",
  orders: "Заявки",
  clients: "Клиенты",
  invoices: "Накладные",
  cash: "Касса",
  warehouse: "Склад",
  suppliers: "Поставщики",
  plans: "Планы",
  staff: "Пользователи",
  gps: "GPS",
  settings: "Настройки",
  finance: "Финансы",
  reports: "Отчёт",
  users: "Пользователи",
  access: "Доступ",
  audit: "Аудит",
  general: "Общее",
  misc: "Разное"
};

function staffSectionParentLabel(section: string): string | null {
  const s = section.trim();
  const rules: [RegExp, string][] = [
    [/Пользователи\s*\/\s*Настройки аудита/i, "Аудит"],
    [/Пользователи\s*\/\s*Аудитор/i, "Аудит"],
    [/Пользователи\s*\/\s*Агент/i, "Агенты"],
    [/Пользователи\s*\/\s*Экспедитор/i, "Экспедиторы"],
    [/Пользователи\s*\/\s*Супервайзер/i, "Супервайзеры"],
    [/Пользователи\s*\/\s*Инкассатор/i, "Инкассаторы"],
    [/Пользователи\s*\/\s*Сотрудники/i, "Сотрудники"],
    [/Пользователи\s*\/\s*Партнёры/i, "Партнёры"],
    [/Пользователи\s*\/\s*Партнеры/i, "Партнёры"],
    [/Пользователи\s*\/\s*KPI/i, "KPI"],
    [/Пользователи\s*\/\s*Зарплаты/i, "Зарплаты"],
    [/Пользователи\s*\/\s*Рабочие дни/i, "Рабочие дни"],
    [/Пользователи\s*\/\s*Табель/i, "Табель"],
    [/Пользователи\s*\/\s*Задачи/i, "Задачи"]
  ];
  for (const [re, label] of rules) {
    if (re.test(s)) return label;
  }
  if (/^Пользователи(\s*\/|\s*$)/i.test(s)) return "Пользователи";
  return null;
}

/** Value shown as `parent_path` in GET .../permissions/catalog (RU, matches main nav). */
export function catalogParentPathLabel(module: string, section: string | null | undefined): string {
  const sec = section?.trim();
  if (module === "staff" && sec) {
    const staff = staffSectionParentLabel(sec);
    if (staff) return staff;
  }
  return MODULE_PARENT_LABEL_RU[module] ?? module;
}
