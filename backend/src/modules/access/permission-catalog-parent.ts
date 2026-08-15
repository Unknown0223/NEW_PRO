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
  routes: "Маршруты",
  automation: "Автоматизация",
  /** Pivot = konstruktor bilan bir oila (nav: Конструктор сводной таблицы). */
  pivot: "Отчёт",
  work_slots: "Рабочее место",
  diagnostics: "Диагностика",
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
    [/Пользователи\s*\/\s*Складчик/i, "Складчики"],
    [/Пользователи\s*\/\s*Консигнация/i, "Консигнация"],
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

/**
 * Legacy `plans.otchety.*` tarixan «Планы / Отчеты» ostida edi — aslida otchot/konstruktor.
 * Haqiqiy plan bo‘limlari: Установка планов, Настройка утверждающих.
 */
function plansSectionParentLabel(section: string): string | null {
  const s = section.trim();
  if (/Конструктор\s+отч[её]тов/i.test(s) || /\/\s*Конструктор/i.test(s)) {
    return "Отчёт · Конструктор отчётов";
  }
  if (/Отч[её]т/i.test(s) && !/Установка\s+планов/i.test(s) && !/утверждающ/i.test(s)) {
    return "Отчёт · Отчеты";
  }
  if (/Установка\s+планов/i.test(s)) return "Планы · Установка планов";
  if (/утверждающ/i.test(s)) return "Планы · Настройка утверждающих";
  if (/^Планы(\s*\/|\s*$)/i.test(s)) return "Планы";
  return null;
}

function reportsSectionParentLabel(section: string): string | null {
  const s = section.trim();
  if (/Конструктор/i.test(s) || /Сводн/i.test(s)) return "Отчёт · Конструктор отчётов";
  if (/Отч[её]т/i.test(s)) return "Отчёт · Отчеты";
  return null;
}

/** Value shown as `parent_path` in GET .../permissions/catalog (RU, matches main nav). */
export function catalogParentPathLabel(module: string, section: string | null | undefined): string {
  const sec = section?.trim();
  if (module === "staff" && sec) {
    const staff = staffSectionParentLabel(sec);
    if (staff) return staff;
  }
  if (module === "plans" && sec) {
    const plans = plansSectionParentLabel(sec);
    if (plans) return plans;
  }
  if ((module === "reports" || module === "pivot") && sec) {
    const reports = reportsSectionParentLabel(sec);
    if (reports) return reports;
  }
  if (module === "pivot") {
    return "Отчёт · Конструктор отчётов";
  }

  const modLabel = MODULE_PARENT_LABEL_RU[module] ?? module;
  // Strukturali katalog: section = labelRu («Остатки товаров») — modul · bo‘lim.
  // Legacy «Модуль / Раздел» yo‘llari — faqat modul (slash bilan chalkashmaslik),
  // lekin plans/reports yuqorida maxsus qayta yo‘naltiriladi.
  if (sec && !sec.includes("/") && sec !== modLabel) {
    return `${modLabel} · ${sec}`;
  }
  return modLabel;
}
