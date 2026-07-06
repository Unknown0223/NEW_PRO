/**
 * Strukturali (CRUD) ruxsat modeli.
 *
 * Eski "tekis" kalitlar (legacy-permissions.generated.ts) o'rniga, har bir bo'lim
 * (`module.section`) uchun amal tiplari (`action`) bilan struktura qilingan katalog.
 *
 * Kalit ko'rinishi: `<module>.<section>.<action>` (masalan `orders.zakaz.create`).
 * Bu modul faqat metama'lumot (catalog) — DB seed `permission-catalog.service.ts` da.
 */

/** Qo'llab-quvvatlanadigan amal tiplari. CRUD + alohida holat tiplari + qo'shimcha. */
export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "copy",
  "activate",
  "deactivate",
  "import",
  "status",
  "assign",
  "approve",
  "transfer",
  "history"
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** UI grid ustunlari uchun barqaror tartib. */
export const PERMISSION_ACTION_ORDER: Record<PermissionAction, number> = {
  view: 10,
  create: 20,
  update: 30,
  delete: 40,
  copy: 50,
  activate: 60,
  deactivate: 70,
  import: 80,
  status: 90,
  assign: 100,
  approve: 110,
  transfer: 120,
  history: 130
};

export const PERMISSION_ACTION_LABEL_RU: Record<PermissionAction, string> = {
  view: "Просмотр",
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  copy: "Копирование/Выгрузка",
  activate: "Активация",
  deactivate: "Деактивация",
  import: "Импорт",
  status: "Изменение статуса",
  assign: "Прикрепление",
  approve: "Утверждение",
  transfer: "Перемещение",
  history: "История"
};

export const PERMISSION_ACTION_LABEL_UZ: Record<PermissionAction, string> = {
  view: "Ko'rish",
  create: "Yaratish",
  update: "O'zgartirish",
  delete: "O'chirish",
  copy: "Ko'chirib olish",
  activate: "Aktiv qilish",
  deactivate: "Neaktiv qilish",
  import: "Import",
  status: "Status o'zgartirish",
  assign: "Biriktirish",
  approve: "Tasdiqlash",
  transfer: "Ko'chirish",
  history: "Tarix"
};

/** Modul (RU) yorliqlari — Access UI «Родитель» ustuni bilan mos. */
export const PERMISSION_MODULE_LABEL_RU: Record<string, string> = {
  dashboard: "Дашборд",
  orders: "Заявки",
  clients: "Клиенты",
  invoices: "Накладные",
  cash: "Касса",
  warehouse: "Склад",
  suppliers: "Поставщики",
  plans: "Планы",
  reports: "Отчёт",
  staff: "Пользователи",
  gps: "GPS",
  routes: "Маршруты",
  settings: "Настройки",
  automation: "Автоматизация",
  audit: "Аудит",
  finance: "Финансы",
  pivot: "Pivot отчёты",
  access: "Доступ",
  users: "Пользователи",
  work_slots: "Рабочее место"
};

export type PermissionSectionDef = {
  module: string;
  /** `section` slug — kalitning ikkinchi qismi (`module.<section>.action`). */
  section: string;
  /** RU yorliq (UI «Раздел»). */
  labelRu: string;
  /** Shu bo'lim qo'llaydigan amal tiplari (faqat shular UI gridda ustun bo'ladi). */
  actions: PermissionAction[];
};

/** Ko'p qo'llaniladigan amal to'plamlari (qisqartma uchun). */
const CRUD: PermissionAction[] = ["view", "create", "update", "delete"];
const CRUD_COPY: PermissionAction[] = ["view", "create", "update", "delete", "copy"];
const VIEW_ONLY: PermissionAction[] = ["view"];
const VIEW_COPY: PermissionAction[] = ["view", "copy"];

/**
 * Barcha modul/bo'limlar va ularning amal tiplari.
 * Faza bo'yicha to'ldirilgan; yangi bo'limlar (warehouse to'liq, gps/routes,
 * automation, pivot, audit, finance, work_slots) ham shu yerda.
 */
export const PERMISSION_SECTIONS: PermissionSectionDef[] = [
  // ── Dashboard ──────────────────────────────────────────────
  { module: "dashboard", section: "prodazhi", labelRu: "Продажи", actions: VIEW_COPY },
  { module: "dashboard", section: "finansy", labelRu: "Финансы", actions: VIEW_COPY },
  { module: "dashboard", section: "supervayzer", labelRu: "Супервайзер", actions: VIEW_COPY },
  { module: "dashboard", section: "plan_fakt", labelRu: "План/Факт", actions: VIEW_COPY },

  // ── Orders (Заявки) ────────────────────────────────────────
  { module: "orders", section: "zakaz", labelRu: "Заказ", actions: ["view", "create", "update", "delete", "copy", "status", "assign", "history"] },
  { module: "orders", section: "vozvrat", labelRu: "Возврат", actions: ["view", "create", "update", "delete", "status", "history"] },
  { module: "orders", section: "obmen_i_otkaz", labelRu: "Обмен и отказ", actions: ["view", "create", "update", "status"] },
  { module: "orders", section: "status", labelRu: "Статус", actions: ["view", "status"] },
  { module: "orders", section: "usloviya_ogranicheniya", labelRu: "Условия ограничения заказа", actions: ["view", "create", "update"] },
  { module: "orders", section: "predlozhenie", labelRu: "Предложение для создания заказа", actions: ["view", "create"] },
  { module: "orders", section: "drugie_operacii", labelRu: "Другие операции", actions: ["view", "copy", "assign", "update"] },

  // ── Clients (Клиенты) ──────────────────────────────────────
  { module: "clients", section: "klient", labelRu: "Клиент", actions: ["view", "create", "update", "delete", "import", "copy", "assign", "activate", "deactivate", "history"] },
  { module: "clients", section: "profil", labelRu: "Профиль клиента", actions: ["view", "update", "copy"] },
  { module: "clients", section: "qr_kody", labelRu: "QR коды клиентов", actions: ["view", "create", "copy", "status", "assign"] },
  { module: "clients", section: "oborudovanie", labelRu: "Оборудование", actions: ["view", "create", "update", "delete"] },
  { module: "clients", section: "obedinenie", labelRu: "Объединение", actions: ["view", "update"] },
  { module: "clients", section: "konkurs", labelRu: "Конкурс клиентов", actions: ["view", "create"] },
  { module: "clients", section: "otchety", labelRu: "Отчеты", actions: VIEW_COPY },

  // ── Invoices (Накладные) ───────────────────────────────────
  { module: "invoices", section: "sborochnye", labelRu: "Сборочные накладные", actions: ["view", "create", "update", "delete", "status", "copy"] },
  { module: "invoices", section: "otgruzochnye", labelRu: "Отгрузочные накладные", actions: ["view", "create", "status", "copy"] },
  { module: "invoices", section: "vozvratnye", labelRu: "Возвратные накладные", actions: ["view", "create", "status", "delete"] },
  { module: "invoices", section: "spisanie_dolga", labelRu: "Списание долга", actions: ["view", "create", "status", "delete"] },

  // ── Cash (Касса) ───────────────────────────────────────────
  { module: "cash", section: "oplaty_klientov", labelRu: "Оплаты клиентов", actions: ["view", "create", "update", "delete", "copy", "history"] },
  { module: "cash", section: "rashody_klienta", labelRu: "Расходы клиента", actions: CRUD },
  { module: "cash", section: "nachalnye_balansy", labelRu: "Начальные балансы клиентов", actions: ["view", "create", "update"] },
  { module: "cash", section: "otchety", labelRu: "Отчеты", actions: VIEW_COPY },
  { module: "cash", section: "kassa", labelRu: "Касса", actions: ["view", "create", "status", "history"] },
  { module: "cash", section: "kurs_valyuty", labelRu: "Курс валюты", actions: ["view", "create", "update"] },
  { module: "cash", section: "prihody", labelRu: "Приходы", actions: ["view", "create", "delete"] },
  { module: "cash", section: "zayavki_na_oplatu", labelRu: "Заявки на оплату", actions: ["view", "approve", "copy"] },
  { module: "cash", section: "dolgi_ekspeditora", labelRu: "Долги экспедитора", actions: VIEW_COPY },

  // ── Warehouse (Склад) — to'liq (yangi) ─────────────────────
  { module: "warehouse", section: "sklady", labelRu: "Склады", actions: ["view", "create", "update", "delete", "history"] },
  { module: "warehouse", section: "bloki", labelRu: "Блоки склада", actions: CRUD },
  { module: "warehouse", section: "ostatki", labelRu: "Остатки товаров", actions: VIEW_COPY },
  { module: "warehouse", section: "rekomendovannyy_zapas", labelRu: "Рекомендованный запас", actions: ["view", "update"] },
  { module: "warehouse", section: "ostatki_na_datu", labelRu: "Остатки на дату", actions: VIEW_COPY },
  { module: "warehouse", section: "postuplenie", labelRu: "Поступление склада", actions: ["view", "create", "update", "delete", "copy", "history"] },
  { module: "warehouse", section: "peremeshchenie", labelRu: "Перемещение товара", actions: ["view", "create", "update", "transfer", "history"] },
  { module: "warehouse", section: "korrektirovka", labelRu: "Корректировка склада", actions: ["view", "create", "update", "history"] },
  { module: "warehouse", section: "materialnyy_otchet", labelRu: "Материальный отчёт", actions: VIEW_COPY },
  { module: "warehouse", section: "spisanie", labelRu: "Списание", actions: ["view", "create", "delete"] },

  // ── Suppliers (Поставщики) ─────────────────────────────────
  { module: "suppliers", section: "postavshchik", labelRu: "Поставщики", actions: ["view", "create", "update", "delete", "copy", "history"] },
  { module: "suppliers", section: "oplaty", labelRu: "Оплаты поставщикам", actions: CRUD },
  { module: "suppliers", section: "balansy", labelRu: "Начальные балансы", actions: VIEW_COPY },

  // ── Plans (Планы) ──────────────────────────────────────────
  { module: "plans", section: "nastroyka_utverzhdayushchih", labelRu: "Настройка утверждающих", actions: ["view", "update"] },
  { module: "plans", section: "ustanovka_planov", labelRu: "Установка планов", actions: ["view", "create", "update", "status", "approve"] },

  // ── Reports (Отчёт) ────────────────────────────────────────
  { module: "reports", section: "otchety", labelRu: "Отчеты", actions: VIEW_COPY },

  // ── Staff (Пользователи) ───────────────────────────────────
  { module: "staff", section: "agent", labelRu: "Агент", actions: ["view", "create", "update", "delete", "copy", "assign", "activate", "deactivate", "history"] },
  { module: "staff", section: "ekspeditor", labelRu: "Экспедитор", actions: ["view", "create", "update", "assign", "activate", "deactivate", "history"] },
  { module: "staff", section: "supervayzer", labelRu: "Супервайзер", actions: ["view", "create", "update", "delete", "assign", "activate", "deactivate", "history"] },
  { module: "staff", section: "inkassator", labelRu: "Инкассатор", actions: ["view", "create", "update", "assign", "activate", "deactivate", "history"] },
  { module: "staff", section: "auditor", labelRu: "Аудитор", actions: ["view", "create", "update", "assign", "activate", "deactivate", "history"] },
  { module: "staff", section: "nastroyki_audita", labelRu: "Настройки аудита", actions: CRUD },
  { module: "staff", section: "sotrudniki", labelRu: "Сотрудники", actions: ["view", "create", "update", "activate", "deactivate"] },
  { module: "staff", section: "partnery", labelRu: "Партнёры", actions: VIEW_ONLY },
  { module: "staff", section: "kpi", labelRu: "KPI", actions: ["view", "create", "import", "copy"] },
  { module: "staff", section: "zarplaty", labelRu: "Зарплаты", actions: ["view", "create", "copy"] },
  { module: "staff", section: "rabochie_dni", labelRu: "Рабочие дни", actions: ["view", "create", "update"] },
  { module: "staff", section: "tabel", labelRu: "Табель", actions: ["view", "create", "update"] },
  { module: "staff", section: "zadachi", labelRu: "Задачи", actions: ["view", "create", "update"] },

  // ── GPS / Routes ───────────────────────────────────────────
  { module: "gps", section: "gps", labelRu: "GPS", actions: ["view", "update"] },
  { module: "routes", section: "marshruty", labelRu: "Маршруты", actions: ["view", "update", "copy"] },
  { module: "routes", section: "trek", labelRu: "Трек", actions: VIEW_ONLY },

  // ── Settings (Настройки) ───────────────────────────────────
  { module: "settings", section: "tovar", labelRu: "Товар", actions: ["view", "create", "update", "delete", "import", "history"] },
  { module: "settings", section: "kategoriya_tovara", labelRu: "Категория товара", actions: CRUD },
  { module: "settings", section: "tsena", labelRu: "Цена", actions: ["view", "create", "update", "history"] },
  { module: "settings", section: "tip_tseny", labelRu: "Тип цены", actions: CRUD },
  { module: "settings", section: "territoriya", labelRu: "Территория", actions: CRUD },
  { module: "settings", section: "sposob_oplaty", labelRu: "Способ оплаты", actions: CRUD },
  { module: "settings", section: "valyuty", labelRu: "Валюты", actions: CRUD },
  { module: "settings", section: "filial", labelRu: "Филиал", actions: CRUD },
  { module: "settings", section: "dolzhnost", labelRu: "Должность", actions: CRUD },
  { module: "settings", section: "edinitsy", labelRu: "Единицы измерения", actions: CRUD },
  { module: "settings", section: "brend", labelRu: "Бренд", actions: CRUD },
  { module: "settings", section: "segment", labelRu: "Сегмент", actions: CRUD },
  { module: "settings", section: "kanal_sbyta", labelRu: "Канал сбыта", actions: CRUD },
  { module: "settings", section: "napravlenie_torgovli", labelRu: "Направление торговли", actions: CRUD },
  { module: "settings", section: "format_klienta", labelRu: "Формат клиента", actions: CRUD },
  { module: "settings", section: "tip_klienta", labelRu: "Тип клиента", actions: CRUD },
  { module: "settings", section: "kategoriya_klienta", labelRu: "Категория клиента", actions: CRUD },
  { module: "settings", section: "bonusy_i_skidki", labelRu: "Бонусы и скидки", actions: CRUD },
  { module: "settings", section: "ustanovit_natsenku", labelRu: "Наценка", actions: ["view", "update"] },
  { module: "settings", section: "profil_kompanii", labelRu: "Профиль компании", actions: ["view", "update"] },
  { module: "settings", section: "zakrytie_perioda", labelRu: "Закрытие периода", actions: ["view", "status"] },
  { module: "settings", section: "prichiny", labelRu: "Причины и примечания", actions: CRUD },
  { module: "settings", section: "tipy_zadach", labelRu: "Типы задач", actions: CRUD },
  { module: "settings", section: "inventar_i_korobka", labelRu: "Инвентарь и упаковка", actions: CRUD },
  { module: "settings", section: "oborudovanie", labelRu: "Оборудование (принтеры/тара)", actions: CRUD },
  { module: "settings", section: "baza_znaniy", labelRu: "База знаний", actions: CRUD },
  { module: "settings", section: "seansy", labelRu: "Сеансы пользователей", actions: ["view", "update", "status"] },

  // ── Automation (Автоматизация заявок) — yangi ──────────────
  { module: "automation", section: "zaiavki", labelRu: "Автоматизация заявок", actions: ["view", "create", "update", "delete", "status"] },

  // ── Audit — yangi ──────────────────────────────────────────
  { module: "audit", section: "log", labelRu: "Аудит", actions: VIEW_COPY },

  // ── Finance — yangi ────────────────────────────────────────
  { module: "finance", section: "obzor", labelRu: "Финансы", actions: ["view", "approve", "copy"] },

  // ── Pivot — yangi ──────────────────────────────────────────
  { module: "pivot", section: "otchety", labelRu: "Pivot отчёты", actions: VIEW_COPY },

  // ── Work slots (Рабочее место) — yangi ─────────────────────
  { module: "work_slots", section: "raboche_mesto", labelRu: "Рабочее место", actions: ["view", "create", "update"] },

  // ── Access (Доступ) ────────────────────────────────────────
  { module: "access", section: "upravlenie", labelRu: "Доступ", actions: ["view", "update", "history"] }
];

export function permissionKey(module: string, section: string, action: PermissionAction): string {
  return `${module}.${section}.${action}`;
}

export type StructuredPermissionEntry = {
  key: string;
  module: string;
  section: string;
  sectionLabel: string;
  action: PermissionAction;
  description: string;
};

/** Barcha strukturali kalitlarni metama'lumot bilan generatsiya qiladi. */
export function buildStructuredPermissionCatalog(): StructuredPermissionEntry[] {
  const out: StructuredPermissionEntry[] = [];
  for (const def of PERMISSION_SECTIONS) {
    const moduleLabel = PERMISSION_MODULE_LABEL_RU[def.module] ?? def.module;
    const actions = [...def.actions].sort(
      (a, b) => PERMISSION_ACTION_ORDER[a] - PERMISSION_ACTION_ORDER[b]
    );
    for (const action of actions) {
      out.push({
        key: permissionKey(def.module, def.section, action),
        module: def.module,
        section: def.section,
        sectionLabel: def.labelRu,
        action,
        description: `${moduleLabel} / ${def.labelRu} / ${PERMISSION_ACTION_LABEL_RU[action]}`
      });
    }
  }
  return out;
}

/** Kalitdan amal tipini aniqlaydi (oxirgi segment). */
export function extractAction(key: string): PermissionAction | null {
  const last = key.split(".").pop() ?? "";
  return (PERMISSION_ACTIONS as readonly string[]).includes(last) ? (last as PermissionAction) : null;
}
