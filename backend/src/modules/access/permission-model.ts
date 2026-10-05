/**
 * Strukturali (CRUD) ruxsat modeli.
 *
 * Eski "tekis" kalitlar (legacy-permissions.generated.ts) o'rniga, har bir bo'lim
 * (`module.section`) uchun amal tiplari (`action`) bilan struktura qilingan katalog.
 *
 * Kalit ko'rinishi: `<module>.<section>.<action>` (masalan `orders.zakaz.create`).
 * Bu modul faqat metama'lumot (catalog) — DB seed `permission-catalog.service.ts` da.
 */
import { PERMISSION_OP_LABEL_RU } from "./permission-op-labels";
import { CLIENT_PERMISSION_SECTIONS } from "./permission-client-sections";
import { ORDER_PERMISSION_SECTIONS } from "./permission-order-sections";

/** Qo'llab-quvvatlanadigan amal tiplari. CRUD + soft-void + alohida holat tiplari. */
export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "void",
  "restore",
  "copy",
  "export",
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
  void: 45,
  restore: 46,
  copy: 50,
  export: 55,
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
  void: "Аннулирование",
  restore: "Восстановление",
  copy: "Копирование/Выгрузка",
  export: "Выгрузка в Excel",
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
  void: "Bekor qilish (arxiv)",
  restore: "Tiklash",
  copy: "Ko'chirib olish",
  export: "Excel yuklab olish",
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
  settings: "Настройки",
  automation: "Автоматизация",
  audit: "Аудит",
  finance: "Финансы",
  pivot: "Сводные отчёты",
  access: "Доступ",
  users: "Пользователи",
  work_slots: "Рабочее место",
  diagnostics: "Диагностика",
  activity: "Активность"
}

export type PermissionSectionDef = {
  module: string;
  /** `section` slug — kalitning ikkinchi qismi (`module.<section>.action`). */
  section: string;
  /** RU yorliq (UI «Раздел»). */
  labelRu: string;
  /** Shu bo'lim qo'llaydigan amal tiplari (faqat shular UI gridda ustun bo'ladi). */
  actions: PermissionAction[];
  /** Access UI'dagi guruh (RU) — kalit moduli o'zgarmagan holda boshqa bo'limda ko'rsatish uchun. */
  groupRu?: string;
  /** «Операции» daraxtida shu nomli bo'limga qo'shiladi (bir nechta kichik bo'lim bitta guruhda). */
  treeSectionRu?: string;
};

export const PAYROLL_GROUP_RU = "Зарплата";
const CONSIGNMENT_TREE_RU = "Консигнация и лимиты агентов";
const REPORTS_TREE_RU = "Отчеты";
const DICTIONARIES_TREE_RU = "Справочники";
const SYSTEM_SETTINGS_TREE_RU = "Системные настройки";
/** Ko'p qo'llaniladigan amal to'plamlari (qisqartma uchun). */
const CRUD: PermissionAction[] = ["view", "create", "update", "delete"];
const VIEW_ONLY: PermissionAction[] = ["view"];
const VIEW_COPY: PermissionAction[] = ["view", "copy"];
const VIEW_EXPORT: PermissionAction[] = ["view", "export"];
const STAFF_CRUD: PermissionAction[] = ["view", "create", "update", "activate", "deactivate", "export", "history"];

/**
 * Barcha modul/bo'limlar va ularning amal tiplari.
 * Faqat tizimda haqiqatan tekshiriladigan amallar (route guard, `requirePermission`,
 * frontend `Can`/nav) — hech narsani ochmaydigan kalitlar katalogga kiritilmaydi.
 */
export const PERMISSION_SECTIONS: PermissionSectionDef[] = [
  // ── Dashboard ──────────────────────────────────────────────
  { module: "dashboard", section: "prodazhi", labelRu: "Дашборд продаж", actions: VIEW_EXPORT },
  { module: "dashboard", section: "finansy", labelRu: "Дашборд финансов", actions: VIEW_EXPORT },
  { module: "dashboard", section: "supervayzer", labelRu: "Дашборд супервайзера", actions: VIEW_EXPORT },
  { module: "dashboard", section: "plan_fakt", labelRu: "Мониторинг продаж и планов", actions: VIEW_ONLY },

  // ── Orders (Заявки) ────────────────────────────────────────
  ...ORDER_PERMISSION_SECTIONS,

  // ── Clients (Клиенты) ──────────────────────────────────────
  ...CLIENT_PERMISSION_SECTIONS,

  // ── Invoices (Накладные) ───────────────────────────────────
  { module: "invoices", section: "sborochnye", labelRu: "Сборочные накладные", actions: VIEW_ONLY },
  { module: "invoices", section: "otgruzochnye", labelRu: "Отгрузочные накладные", actions: VIEW_ONLY },
  { module: "invoices", section: "vozvratnye", labelRu: "Возвратные накладные", actions: ["view", "approve"] },

  // ── Cash (Кассы) ───────────────────────────────────────────
  { module: "cash", section: "oplaty_klientov", labelRu: "Оплаты клиентов", actions: ["view", "create", "update", "approve", "export", "delete", "history"] },
  { module: "cash", section: "perechisleniya", labelRu: "Перечисления (банк)", actions: ["view", "create", "update", "import"] },
  { module: "cash", section: "rashody_klienta", labelRu: "Расходы клиента", actions: CRUD },
  { module: "cash", section: "nachalnye_balansy", labelRu: "Начальные балансы клиентов", actions: ["view", "create", "update", "void", "restore"] },
  /** Alohida: «Балансы клиентов» — `cash.otchety` (Отчёты) bilan aralashmasin. */
  { module: "cash", section: "balansy_klientov", labelRu: "Балансы клиентов (оплата и долги)", actions: VIEW_EXPORT, treeSectionRu: REPORTS_TREE_RU },
  { module: "cash", section: "otchety", labelRu: "Отчёты кассы (приходы, ДДС, акт сверки, долги)", actions: VIEW_EXPORT, treeSectionRu: REPORTS_TREE_RU },
  { module: "cash", section: "kassa", labelRu: "Касса", actions: ["view", "create", "update", "status", "export", "history"] },
  { module: "cash", section: "kurs_valyuty", labelRu: "Курс валют", actions: ["view", "create", "update", "export"] },
  { module: "cash", section: "prihody", labelRu: "Приходы", actions: VIEW_ONLY },
  { module: "cash", section: "zayavki_na_oplatu", labelRu: "Заявки на оплату", actions: ["view", "approve", "export"] },
  { module: "cash", section: "dolgi_ekspeditora", labelRu: "Долги экспедитора", actions: VIEW_ONLY },

  // ── Warehouse (Склады) ─────────────────────────────────────
  { module: "warehouse", section: "sklady", labelRu: "Склады", actions: ["view", "create", "update", "deactivate", "activate", "export", "history"] },
  { module: "warehouse", section: "bloki", labelRu: "Блок склада", actions: [...CRUD, "export"] },
  { module: "warehouse", section: "postuplenie", labelRu: "Поступление товаров", actions: ["view", "create", "update", "delete", "import", "status", "export", "history"] },
  { module: "warehouse", section: "peremeshchenie", labelRu: "Перемещение товара", actions: ["view", "create", "update", "transfer", "export"] },
  { module: "warehouse", section: "korrektirovka", labelRu: "Корректировка склада (инвентаризация)", actions: ["view", "create", "update", "export"] },
  { module: "warehouse", section: "ostatki", labelRu: "Остатки товаров", actions: VIEW_COPY, treeSectionRu: REPORTS_TREE_RU },
  { module: "warehouse", section: "rekomendovannyy_zapas", labelRu: "Рекомендованный запас", actions: VIEW_EXPORT, treeSectionRu: REPORTS_TREE_RU },
  { module: "warehouse", section: "ostatki_na_datu", labelRu: "Остатки на определенную дату", actions: VIEW_COPY, treeSectionRu: REPORTS_TREE_RU },
  { module: "warehouse", section: "materialnyy_otchet", labelRu: "Материальный отчет", actions: VIEW_EXPORT, treeSectionRu: REPORTS_TREE_RU },

  // ── Suppliers (Поставщики) ─────────────────────────────────
  { module: "suppliers", section: "postavshchik", labelRu: "Поставщики", actions: ["view", "create", "update", "delete", "export", "history"] },
  { module: "suppliers", section: "oplaty", labelRu: "Оплаты поставщикам", actions: ["view", "create", "update", "export"] },
  { module: "suppliers", section: "balansy", labelRu: "Начальные балансы и акт сверки с поставщиком", actions: VIEW_EXPORT },

  // ── Plans (Планы) ──────────────────────────────────────────
  { module: "plans", section: "nastroyka_utverzhdayushchih", labelRu: "Настройка утверждающих", actions: ["view", "update"] },
  { module: "plans", section: "ustanovka_planov", labelRu: "Установка планов", actions: ["view", "create", "update", "approve"] },

  // ── Reports (Отчёт) — har bir hisobot sahifasi alohida ─────
  { module: "reports", section: "zakazy_agentov", labelRu: "Заказы по агентам", actions: VIEW_ONLY },
  { module: "reports", section: "gps", labelRu: "Отчёт по GPS (маршруты доставки)", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_klientov_2", labelRu: "Продажи по клиентам 2", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_klientov_4", labelRu: "Продажи по клиентам 4", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_tovarov", labelRu: "Продажи по товарам", actions: VIEW_EXPORT },
  { module: "reports", section: "vozvrat_ekspeditora", labelRu: "Возврат экспедитора", actions: VIEW_EXPORT },
  { module: "reports", section: "vizity", labelRu: "По визитам 2.0", actions: VIEW_EXPORT },
  { module: "reports", section: "itogi_vizitov", labelRu: "Итоги визитов", actions: VIEW_EXPORT },
  { module: "reports", section: "dnevnye_kpi_plany", labelRu: "Дневные KPI планы", actions: VIEW_EXPORT },
  {
    module: "reports",
    section: "konstruktor",
    labelRu: "Конструктор сводной таблицы",
    actions: ["view", "create", "update", "delete", "export", "transfer"]
  },

  // ── Staff (Пользователи) ───────────────────────────────────
  { module: "staff", section: "agent", labelRu: "Агент", actions: ["view", "create", "update", "delete", "export", "activate", "deactivate", "history"] },
  { module: "staff", section: "ekspeditor", labelRu: "Экспедитор", actions: STAFF_CRUD },
  { module: "staff", section: "supervayzer", labelRu: "Супервайзер", actions: STAFF_CRUD },
  { module: "staff", section: "skladchik", labelRu: "Складчик", actions: STAFF_CRUD },
  { module: "staff", section: "inkassator", labelRu: "Инкассатор", actions: STAFF_CRUD },
  { module: "staff", section: "auditor", labelRu: "Аудитор", actions: STAFF_CRUD },
  { module: "staff", section: "sotrudniki", labelRu: "Сотрудники", actions: ["view", "create", "update", "activate", "deactivate", "export"] },
  { module: "staff", section: "konsignatsiya", labelRu: "Консигнация и лимиты агентов", actions: ["view", "status", "update", "import", "export"] },
  { module: "staff", section: "konsignatsiya_zakrytie", labelRu: "Время автозакрытия консигнации", actions: ["update"], treeSectionRu: CONSIGNMENT_TREE_RU },
  { module: "staff", section: "konsignatsiya_perekid", labelRu: "Перераспределение лимита консигнации", actions: ["update"], treeSectionRu: CONSIGNMENT_TREE_RU },
  { module: "staff", section: "konsignatsiya_limity", labelRu: "Установка лимитов консигнации (прошлый месяц / % от плана)", actions: ["update"], treeSectionRu: CONSIGNMENT_TREE_RU },
  { module: "staff", section: "tabel", labelRu: "Табель (посещаемость)", actions: ["view", "update", "export", "history"] },
  { module: "staff", section: "rabochie_dni", labelRu: "Рабочие дни (график)", actions: ["view", "update", "create", "delete", "status", "history"] },
  { module: "staff", section: "tabel_normativ", labelRu: "Табель · Норматив агентов", actions: ["view", "update"] },
  { module: "staff", section: "zadachi_spisok", labelRu: "Задачи (поручения сотрудникам)", actions: ["view", "create", "update", "delete", "export"] },
  { module: "settings", section: "tipy_zadach", labelRu: "Типы задач (справочник)", actions: VIEW_ONLY, groupRu: "Пользователи" },
  { module: "staff", section: "zadachi", labelRu: "Уведомления (колокольчик)", actions: ["view", "update"] },

  // ── GPS — har bir xodim turi alohida (GPS мониторинг xaritasi) ──
  { module: "gps", section: "agenty", labelRu: "GPS мониторинг по агентам", actions: VIEW_EXPORT },
  { module: "gps", section: "dostavshchiki", labelRu: "GPS мониторинг по доставщикам (экспедиторам)", actions: VIEW_EXPORT },
  { module: "gps", section: "supervayzery", labelRu: "GPS мониторинг по супервайзерам", actions: VIEW_EXPORT },
  { module: "gps", section: "inkassatory", labelRu: "GPS мониторинг по инкассаторам", actions: VIEW_EXPORT },
  { module: "gps", section: "van_selling", labelRu: "GPS мониторинг по ван-селлингу", actions: VIEW_EXPORT },
  { module: "gps", section: "trek", labelRu: "Трек передвижения на карте", actions: VIEW_ONLY },
  { module: "gps", section: "marshrut", labelRu: "Маршрут дня агента (порядок визитов)", actions: ["view", "update"] },

  // ── Settings (Настройки) ───────────────────────────────────
  { module: "settings", section: "tovar", labelRu: "Товар", actions: ["view", "create", "update", "delete", "import", "copy", "history"] },
  { module: "settings", section: "tsena", labelRu: "Цена", actions: ["view", "create", "update", "import", "history"] },
  { module: "settings", section: "bonusy", labelRu: "Бонусы (товар в подарок)", actions: ["view", "create", "update", "delete", "export", "history"] },
  { module: "settings", section: "skidki", labelRu: "Скидки (процент / от суммы)", actions: ["view", "create", "update", "delete", "export", "history"] },
  { module: "settings", section: "bonus_strategiya", labelRu: "Стратегии и порядок применения бонусов и скидок", actions: CRUD },
  { module: "settings", section: "territoriya", labelRu: "Территория", actions: CRUD },
  { module: "settings", section: "napravlenie_torgovli", labelRu: "Направление торговли", actions: [...CRUD, "export"] },
  { module: "settings", section: "geo_granitsy", labelRu: "Границы на карте", actions: ["view", "create", "update", "void", "assign", "history"] },
  { module: "settings", section: "profil_kompanii", labelRu: "Компания и флаги", actions: ["view", "update"] },
  { module: "settings", section: "mobile_app", labelRu: "Мобильное приложение (обновление APK)", actions: ["view", "update", "import", "transfer"] },
  { module: "settings", section: "document_edit_lock", labelRu: "Ограничение периода редактирования", actions: ["view", "update", "assign"] },
  { module: "settings", section: "system_migration", labelRu: "Системная миграция", actions: ["view", "update", "import"] },
  { module: "settings", section: "kategoriya_tovara", labelRu: "Категория товара", actions: VIEW_EXPORT, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "tip_tseny", labelRu: "Тип цены", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "sposob_oplaty", labelRu: "Способ оплаты", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "valyuty", labelRu: "Валюты", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "filial", labelRu: "Филиал", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "dolzhnost", labelRu: "Должность", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "web_staff_positions", labelRu: "Должности веб-сотрудников", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "edinitsy", labelRu: "Единицы измерения", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "brend", labelRu: "Бренд", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "segment", labelRu: "Сегмент", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "kanal_sbyta", labelRu: "Канал сбыта", actions: VIEW_EXPORT, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "format_klienta", labelRu: "Формат клиента", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "tip_klienta", labelRu: "Тип клиента", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "kategoriya_klienta", labelRu: "Категория клиента", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "prichiny", labelRu: "Причины и примечания", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "inventar_i_korobka", labelRu: "Инвентарь и упаковка", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "oborudovanie", labelRu: "Оборудование (принтеры/тара)", actions: VIEW_ONLY, treeSectionRu: DICTIONARIES_TREE_RU },
  { module: "settings", section: "ustanovit_natsenku", labelRu: "Наценка", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "zakrytie_perioda", labelRu: "Закрытие периода", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "baza_znaniy", labelRu: "База знаний", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "seansy", labelRu: "Сеансы пользователей", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "appearance", labelRu: "Тема и цвета", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "returns_filter", labelRu: "Фильтр возврата", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "orders_consignment", labelRu: "Заказы → консигнация", actions: VIEW_EXPORT, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "timezone", labelRu: "Часовой пояс", actions: VIEW_ONLY, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },
  { module: "settings", section: "initial_setup", labelRu: "Начальная настройка", actions: VIEW_EXPORT, treeSectionRu: SYSTEM_SETTINGS_TREE_RU },

  // ── Audit ──────────────────────────────────────────────────
  // `finance.obzor.view` — `dashboard.finansy.view` bilan bir xil sahifa (alias, `legacy-key-map.ts`).
  { module: "audit", section: "log", labelRu: "Журнал аудита (все изменения в системе)", actions: VIEW_EXPORT },
  { module: "audit", section: "tabel", labelRu: "Аудит табеля и рабочих дней", actions: VIEW_ONLY },
  { module: "audit", section: "podozritelnye_vhody", labelRu: "Подозрительные входы (общие устройства и IP)", actions: ["view", "update", "create", "delete", "export"] },

  // ── Зарплата — kalitlar eski modullarda (grantlar saqlanadi), Access UI'da alohida guruh ─
  { module: "staff", section: "zarplaty", labelRu: "Расчёт зарплаты", actions: ["view", "create", "update", "delete", "copy", "import", "assign", "status", "approve"], groupRu: PAYROLL_GROUP_RU },
  { module: "staff", section: "avans", labelRu: "Аванс (руководитель)", actions: ["view", "create", "update", "delete", "import", "status"], groupRu: PAYROLL_GROUP_RU },
  { module: "staff", section: "avans_limity", labelRu: "Лимиты аванса", actions: ["view", "update"], groupRu: PAYROLL_GROUP_RU },
  { module: "finance", section: "avans", labelRu: "Утверждение авансов", actions: ["view", "approve"], groupRu: PAYROLL_GROUP_RU },
  { module: "cash", section: "vydacha_zarplaty", labelRu: "Выдача аванса и зарплаты (очередь)", actions: ["view", "create", "void", "history"], groupRu: PAYROLL_GROUP_RU },

  // `pivot.otchety.view` — `reports.konstruktor.view` bilan juft alias (`MODULE_VIEW_COMPANIONS`), alohida qatorsiz.

  // ── Work slots / Diagnostics / Activity ────────────────────
  { module: "work_slots", section: "raboche_mesto", labelRu: "Рабочее место", actions: ["view", "create", "update", "assign", "export", "history"] },
  { module: "diagnostics", section: "error_logs", labelRu: "Журнал ошибок", actions: VIEW_EXPORT },
  { module: "activity", section: "history", labelRu: "Активность и история", actions: VIEW_EXPORT },

  // ── Access (Доступ) ────────────────────────────────────────
  { module: "access", section: "upravlenie", labelRu: "Доступ", actions: ["view", "update", "export", "history"] }
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
  /** Operatsiya nomi (SalesDoc terminologiyasi) — «Создание заказа». */
  operationLabel: string;
  description: string;
};

export function permissionOperationLabel(key: string, action: PermissionAction): string {
  return PERMISSION_OP_LABEL_RU[key] ?? PERMISSION_ACTION_LABEL_RU[action];
}

/** Alohida operatsiyani boshqa daraxt bo'limiga ko'chirish (kalit o'zgarmaydi). */
const OP_TREE_SECTION_OVERRIDE_RU: Record<string, string> = {
  "orders.zakaz.copy": "Другие операции",
  "orders.zakaz.assign": "Другие операции"
};

/** «Операции» daraxtidagi bo'lim nomi: operatsiya override → `treeSectionRu` → bo'lim yorlig'i. */
export function permissionTreeSectionLabel(def: PermissionSectionDef, key: string): string {
  return OP_TREE_SECTION_OVERRIDE_RU[key] ?? def.treeSectionRu ?? def.labelRu;
}

/** Barcha strukturali kalitlarni metama'lumot bilan generatsiya qiladi. */
export function buildStructuredPermissionCatalog(): StructuredPermissionEntry[] {
  const out: StructuredPermissionEntry[] = [];
  for (const def of PERMISSION_SECTIONS) {
    const moduleLabel = def.groupRu ?? PERMISSION_MODULE_LABEL_RU[def.module] ?? def.module;
    const actions = [...def.actions].sort(
      (a, b) => PERMISSION_ACTION_ORDER[a] - PERMISSION_ACTION_ORDER[b]
    );
    for (const action of actions) {
      const key = permissionKey(def.module, def.section, action);
      const operationLabel =
        def.actions.length === 1 && !PERMISSION_OP_LABEL_RU[key] && def.treeSectionRu
          ? def.labelRu
          : permissionOperationLabel(key, action);
      out.push({
        key,
        module: def.module,
        section: def.section,
        sectionLabel: def.labelRu,
        action,
        operationLabel,
        description: `${moduleLabel} / ${permissionTreeSectionLabel(def, key)} / ${operationLabel}`
      });
    }
  }
  return out;
}

const GROUPED_SECTION_PREFIXES: Array<[string, string]> = PERMISSION_SECTIONS.filter((d) => d.groupRu).map((d) => [
  `${d.module}.${d.section}.`,
  d.groupRu!
]);

/** Kalit Access UI'da alohida guruhga (masalan «Зарплата») tegishli bo'lsa — guruh nomi. Legacy kalitlar ham prefiks bo'yicha. */
export function permissionDisplayGroup(key: string): string | null {
  for (const [prefix, group] of GROUPED_SECTION_PREFIXES) {
    if (key.startsWith(prefix)) return group;
  }
  return null;
}

/** «Модуль / Раздел / Действие» tavsifining birinchi segmentini guruh nomiga almashtiradi (Операции daraxti shu bo'yicha guruhlaydi). */
export function permissionDisplayDescription(key: string, description: string): string {
  const group = permissionDisplayGroup(key);
  if (!group) return description;
  const parts = description.split(" / ");
  if (parts[0]?.trim() === group) return description;
  return parts.length >= 2 ? [group, ...parts.slice(1)].join(" / ") : `${group} / ${description}`;
}

/** Kalitdan amal tipini aniqlaydi (oxirgi segment). */
export function extractAction(key: string): PermissionAction | null {
  const last = key.split(".").pop() ?? "";
  return (PERMISSION_ACTIONS as readonly string[]).includes(last) ? (last as PermissionAction) : null;
}
