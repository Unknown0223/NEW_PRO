/**
 * Shared staff Excel import — kinds, permissions, template columns, header aliases.
 */

export const STAFF_IMPORT_KINDS = [
  "agent",
  "expeditor",
  "supervisor",
  "collector",
  "auditor",
  "skladchik",
  "operator"
] as const;

export type StaffImportKind = (typeof STAFF_IMPORT_KINDS)[number];

/** URL path segment under /api/:slug/… */
export const STAFF_IMPORT_ROUTE_BASE: Record<StaffImportKind, string> = {
  agent: "agents",
  expeditor: "expeditors",
  supervisor: "supervisors",
  collector: "collectors",
  auditor: "auditors",
  skladchik: "skladchik",
  operator: "operators"
};

/** RBAC: create OR update required for import (upsert). */
export const STAFF_IMPORT_PERMISSIONS: Record<StaffImportKind, { create: string; update: string }> = {
  agent: { create: "staff.agent.create", update: "staff.agent.update" },
  expeditor: { create: "staff.ekspeditor.create", update: "staff.ekspeditor.update" },
  supervisor: { create: "staff.supervayzer.create", update: "staff.supervayzer.update" },
  collector: { create: "staff.inkassator.create", update: "staff.inkassator.update" },
  auditor: { create: "staff.auditor.create", update: "staff.auditor.update" },
  skladchik: { create: "staff.skladchik.create", update: "staff.skladchik.update" },
  operator: { create: "staff.sotrudniki.create", update: "staff.sotrudniki.update" }
};

/** Template sheet name (RU) */
export const STAFF_IMPORT_SHEET_NAME: Record<StaffImportKind, string> = {
  agent: "Агенты",
  expeditor: "Экспедиторы",
  supervisor: "Супервайзеры",
  collector: "Инкассаторы",
  auditor: "Аудиторы",
  skladchik: "Складчики",
  operator: "Сотрудники"
};

/**
 * Importable columns for templates.
 * Align with list Excel export labels where possible; add login/password/work_slot for create.
 */
export type StaffImportTemplateColumn = {
  header: string;
  /** Example / hint row value */
  example: string;
};

const COMMON_LOGIN_COLS: StaffImportTemplateColumn[] = [
  { header: "Ф.И.О", example: "Иванов Иван Иванович" },
  { header: "Авторизоваться", example: "ivanov" },
  { header: "Пароль", example: "Parol123!" },
  { header: "Телефон", example: "+998901234567" },
  { header: "Код", example: "A001" },
  { header: "ПИНФЛ", example: "30101990123456" },
  { header: "Должность", example: "ТП" },
  { header: "Филиал", example: "" },
  { header: "Доступ к приложение", example: "Да" },
  { header: "Максимальное количество сессий", example: "2" }
];

export const STAFF_IMPORT_TEMPLATE_COLUMNS: Record<StaffImportKind, StaffImportTemplateColumn[]> = {
  agent: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Продукт", example: "" },
    { header: "Тип агента", example: "Торговый представитель" },
    { header: "Должность", example: "ТП" },
    { header: "Филиал", example: "" },
    { header: "Направление торговли", example: "" },
    { header: "Склад", example: "" },
    { header: "Доступ к приложение", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  expeditor: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Склад", example: "" },
    { header: "Территория", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Доступ к приложение", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  supervisor: [
    { header: "Ф.И.О", example: "Петров Пётр" },
    { header: "Логин", example: "petrov" },
    { header: "Пароль", example: "Parol123!" },
    { header: "Код", example: "SV01" },
    { header: "ПИНФЛ", example: "" },
    { header: "Телефон", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Агент", example: "A001, A002" },
    { header: "Доступ к приложение", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  collector: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Территория", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Доступ к приложение", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  auditor: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Территория", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Доступ к приложение", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  skladchik: [
    { header: "Ф.И.О", example: "Сидоров Алексей" },
    { header: "Авторизоваться", example: "sidorov" },
    { header: "Пароль", example: "Parol123!" },
    { header: "Код", example: "SK01" },
    { header: "ПИНФЛ", example: "" },
    { header: "Email", example: "" },
    { header: "Телефон", example: "" },
    { header: "Склады", example: "Основной склад" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Доступ к приложение", example: "Нет" },
    { header: "Максимальное количество сессий", example: "1" }
  ],
  operator: [
    { header: "Ф.И.О", example: "Оператор Ольга" },
    { header: "Логин", example: "operator1" },
    { header: "Пароль", example: "Parol123!" },
    { header: "Код", example: "OP01" },
    { header: "ПИНФЛ", example: "" },
    { header: "Email", example: "op@example.com" },
    { header: "Телефон", example: "" },
    { header: "Должность", example: "Оператор" },
    { header: "Системная роль", example: "operator" },
    { header: "Филиал", example: "" },
    { header: "Доступ к приложение", example: "Нет" },
    { header: "Максимальное количество сессий", example: "1" }
  ]
};

/** Field key → RU header aliases (export + template). */
export type StaffImportField =
  | "fio"
  | "login"
  | "password"
  | "phone"
  | "code"
  | "pinfl"
  | "email"
  | "product"
  | "agentType"
  | "workSlot"
  | "position"
  | "branch"
  | "tradeDirection"
  | "warehouse"
  | "warehouses"
  | "territory"
  | "appAccess"
  | "maxSessions"
  | "agentsCol"
  | "webRole";

const BASE_ALIASES: Partial<Record<StaffImportField, string[]>> = {
  fio: ["ф.и.о", "фио", "ф.и.о.", "пользователь", "имя пользователя", "полное имя", "сотрудник"],
  login: ["авторизоваться", "логин", "login"],
  password: ["пароль", "password", "parol"],
  phone: ["телефон", "тел", "phone"],
  code: ["код", "код агента", "код экспедитора", "код супервайзера", "код пользователя", "code"],
  pinfl: ["пинфл", "pinfl"],
  email: ["email", "e-mail", "почта"],
  product: ["продукт"],
  agentType: ["тип агента"],
  workSlot: ["рабочее место", "код рабочего места", "work slot", "work_slot", "slot_code"],
  position: ["должность"],
  branch: ["филиал"],
  tradeDirection: ["направление торговли", "направление"],
  warehouse: ["склад"],
  warehouses: ["склады", "омборлар"],
  territory: ["территория"],
  appAccess: ["доступ к приложение", "доступ к приложению"],
  maxSessions: ["максимальное количество сессий", "макс. сессий", "max sessions"],
  agentsCol: [
    "агент",
    "агенты",
    "агенты супервайзера",
    "подчиненные агенты",
    "назначенные агенты",
    "список агентов"
  ],
  webRole: ["системная роль", "роль", "web role", "role"]
};

export function headerAliasesForKind(kind: StaffImportKind): Record<string, string[]> {
  const pick = (...keys: StaffImportField[]): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const k of keys) {
      const als = BASE_ALIASES[k];
      if (als) out[k] = als;
    }
    return out;
  };

  switch (kind) {
    case "agent":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "product",
        "agentType",
        "workSlot",
        "position",
        "branch",
        "tradeDirection",
        "warehouse",
        "appAccess",
        "maxSessions"
      );
    case "expeditor":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "workSlot",
        "warehouse",
        "territory",
        "branch",
        "position",
        "appAccess",
        "maxSessions"
      );
    case "supervisor":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "branch",
        "position",
        "agentsCol",
        "appAccess",
        "maxSessions"
      );
    case "collector":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "workSlot",
        "territory",
        "branch",
        "position",
        "appAccess",
        "maxSessions"
      );
    case "auditor":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "territory",
        "branch",
        "position",
        "appAccess",
        "maxSessions"
      );
    case "skladchik":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "email",
        "workSlot",
        "warehouses",
        "warehouse",
        "branch",
        "position",
        "appAccess",
        "maxSessions"
      );
    case "operator":
      return pick(
        "fio",
        "login",
        "password",
        "phone",
        "code",
        "pinfl",
        "email",
        "position",
        "webRole",
        "branch",
        "appAccess",
        "maxSessions"
      );
  }
}

export function isStaffImportKind(v: string): v is StaffImportKind {
  return (STAFF_IMPORT_KINDS as readonly string[]).includes(v);
}

export const STAFF_IMPORT_DEFAULT_PASSWORD = "Parol123!";
export const STAFF_IMPORT_MAX_ROWS = 5000;
export const STAFF_IMPORT_MAX_ERRORS = 100;
