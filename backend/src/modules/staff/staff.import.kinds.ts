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
  operator: "Операторы"
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

/** Canonical template headers — match staff / work-slots UI labels. */
const COMMON_LOGIN_COLS: StaffImportTemplateColumn[] = [
  { header: "Ф.И.О", example: "Иванов Иван Иванович" },
  { header: "Логин", example: "ivanov" },
  { header: "Пароль", example: "Parol123!" },
  { header: "Телефон", example: "+998901234567" },
  { header: "Код", example: "A001" },
  { header: "ПИНФЛ", example: "30101990123456" },
  { header: "Должность", example: "ТП" },
  { header: "Филиал", example: "" },
  { header: "Доступ к приложению", example: "Да" },
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
    { header: "Рабочее место", example: "PMAND001" },
    { header: "Доступ к приложению", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  expeditor: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Склад", example: "" },
    { header: "Территория", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Рабочее место", example: "PMEXP001" },
    { header: "Доступ к приложению", example: "Да" },
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
    { header: "Рабочее место", example: "PMSVR001" },
    { header: "Доступ к приложению", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  collector: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Территория", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Рабочее место", example: "PMCOL001" },
    { header: "Доступ к приложению", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  auditor: [
    ...COMMON_LOGIN_COLS.slice(0, 6),
    { header: "Территория", example: "" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Рабочее место", example: "PMAUD001" },
    { header: "Доступ к приложению", example: "Да" },
    { header: "Максимальное количество сессий", example: "2" }
  ],
  skladchik: [
    { header: "Ф.И.О", example: "Сидоров Алексей" },
    { header: "Логин", example: "sidorov" },
    { header: "Пароль", example: "Parol123!" },
    { header: "Код", example: "SK01" },
    { header: "ПИНФЛ", example: "" },
    { header: "Email", example: "" },
    { header: "Телефон", example: "" },
    { header: "Склад", example: "Основной склад" },
    { header: "Филиал", example: "" },
    { header: "Должность", example: "" },
    { header: "Рабочее место", example: "PMSKL001" },
    { header: "Доступ к приложению", example: "Нет" },
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
    { header: "Рабочее место", example: "PMOPR001" },
    { header: "Доступ к приложению", example: "Нет" },
    { header: "Максимальное количество сессий", example: "1" }
  ]
};

/**
 * Сотрудники web-rollari — all-roles shablonda alohida listlar.
 * Import kind always `operator`; sheet name implies default Системная роль.
 */
export const STAFF_OFFICE_IMPORT_SHEETS = [
  {
    webRole: "operator",
    sheetName: "Операторы",
    label: "Оператор",
    exampleLogin: "operator1",
    exampleCode: "OP01",
    exampleSlot: "PMOPR001"
  },
  {
    webRole: "director",
    sheetName: "Директоры",
    label: "Директор",
    exampleLogin: "director1",
    exampleCode: "DR01",
    exampleSlot: "PMDIR001"
  },
  {
    webRole: "sales_director",
    sheetName: "Директор по продажам",
    label: "Директор по продажам",
    exampleLogin: "sales_dir1",
    exampleCode: "SD01",
    exampleSlot: "PMSD001"
  },
  {
    webRole: "manager",
    sheetName: "Менеджеры",
    label: "Менеджер",
    exampleLogin: "manager1",
    exampleCode: "MG01",
    exampleSlot: "PMMGR001"
  },
  {
    webRole: "regional_manager",
    sheetName: "Региональные менеджеры",
    label: "Региональный менеджер",
    exampleLogin: "reg_mgr1",
    exampleCode: "RM01",
    exampleSlot: "PMRM001"
  },
  {
    webRole: "accountant",
    sheetName: "Бухгалтеры",
    label: "Бухгалтер",
    exampleLogin: "accountant1",
    exampleCode: "AC01",
    exampleSlot: "PMACC001"
  },
  {
    webRole: "warehouse_manager",
    sheetName: "Менеджеры склада",
    label: "Менеджер склада",
    exampleLogin: "wh_mgr1",
    exampleCode: "WM01",
    exampleSlot: "PMWM001"
  }
] as const;

export type StaffOfficeWebRole = (typeof STAFF_OFFICE_IMPORT_SHEETS)[number]["webRole"];

export function isStaffOfficeWebRole(v: string): v is StaffOfficeWebRole {
  return STAFF_OFFICE_IMPORT_SHEETS.some((s) => s.webRole === v);
}

export function officeImportSheetByWebRole(webRole: string) {
  return STAFF_OFFICE_IMPORT_SHEETS.find((s) => s.webRole === webRole) ?? null;
}

export function resolveOfficeWebRoleFromSheetName(name: string): StaffOfficeWebRole | null {
  const n = name
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е");
  for (const s of STAFF_OFFICE_IMPORT_SHEETS) {
    if (s.sheetName.toLowerCase().replace(/ё/g, "е") === n) return s.webRole;
    if (s.webRole === n) return s.webRole;
    if (s.label.toLowerCase().replace(/ё/g, "е") === n) return s.webRole;
  }
  // legacy single sheet
  if (n === "сотрудники" || n === "сотрудник") return "operator";
  return null;
}

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
  // Canonical UI: «Логин»; keep «Авторизоваться» for old Excel exports/templates
  login: ["логин", "авторизоваться", "login"],
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
  // «Склад» (UI) + legacy plural «Склады»
  warehouses: ["склад", "склады", "омборлар"],
  territory: ["территория"],
  // Canonical grammar «приложению»; keep typo «приложение» from older templates
  appAccess: ["доступ к приложению", "доступ к приложение"],
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
        "workSlot",
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
        "workSlot",
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
        "workSlot",
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

/** Query for shared /staff/import/* — ?kind=agent|…|all and/or ?mode=all */
export function parseStaffImportKindOrAllQuery(query: unknown): {
  ok: true;
  kind?: StaffImportKind | "all";
  mode?: "all" | "single";
  sheet?: string;
} | { ok: false; issues: string[] } {
  const q = (query && typeof query === "object" ? query : {}) as Record<string, unknown>;
  const kindRaw = q.kind == null ? undefined : String(q.kind);
  const modeRaw = q.mode == null ? undefined : String(q.mode);
  const sheetRaw = q.sheet == null ? undefined : String(q.sheet);
  const issues: string[] = [];

  let kind: StaffImportKind | "all" | undefined;
  if (kindRaw !== undefined) {
    if (kindRaw === "all" || isStaffImportKind(kindRaw)) kind = kindRaw;
    else issues.push(`kind: недопустимое значение`);
  }

  let mode: "all" | "single" | undefined;
  if (modeRaw !== undefined) {
    if (modeRaw === "all" || modeRaw === "single") mode = modeRaw;
    else issues.push(`mode: недопустимое значение`);
  }

  let sheet: string | undefined;
  if (sheetRaw !== undefined) {
    const s = sheetRaw.trim();
    if (!s || s.length > 64) issues.push(`sheet: некорректное значение`);
    else sheet = s;
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, kind, mode, sheet };
}

export function wantsAllRoles(q: { kind?: string; mode?: string }): boolean {
  return q.mode === "all" || q.kind === "all";
}
