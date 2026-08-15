const ACCESS_GRANT_PREFIX = "access.grant.";

const KNOWN_OPERATION_LABEL_RU: Record<string, string> = {
  "access.manage": "Доступ · управление",
  "access.upravlenie.view": "Доступ · просмотр раздела",
  "access.upravlenie.update": "Доступ · изменение прав",
  "access.upravlenie.history": "Доступ · история изменений",
  "audit.log.view": "Журнал аудита · просмотр",
  "audit.log.copy": "Журнал аудита · выгрузка",
  "audit.view": "Аудит · просмотр"
};

/** Modul yorliqlari — backend `PERMISSION_MODULE_LABEL_RU` bilan mos. */
const MODULE_PREFIX_RU: Record<string, string> = {
  access: "Доступ",
  audit: "Аудит",
  automation: "Автоматизация",
  cash: "Касса",
  cashbox: "Касса",
  clients: "Клиенты",
  dashboard: "Дашборд",
  diagnostics: "Диагностика",
  finance: "Финансы",
  gps: "GPS",
  invoices: "Накладные",
  orders: "Заявки",
  pivot: "Отчёт",
  plans: "Планы",
  reports: "Отчёт",
  routes: "Маршруты",
  settings: "Настройки",
  staff: "Пользователи",
  suppliers: "Поставщики",
  users: "Пользователи",
  warehouse: "Склад",
  work_slots: "Рабочее место",
  general: "Общее",
  common: "Общее",
  misc: "Разное"
};

/** Amal yorliqlari — backend `PERMISSION_ACTION_LABEL_RU` bilan mos. */
const ACTION_LABEL_RU: Record<string, string> = {
  view: "Просмотр",
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  void: "Аннулирование",
  restore: "Восстановление",
  copy: "Копирование/Выгрузка",
  activate: "Активация",
  deactivate: "Деактивация",
  manage: "Управление",
  approve: "Утверждение",
  import: "Импорт",
  export: "Экспорт",
  assign: "Прикрепление",
  status: "Изменение статуса",
  transfer: "Перемещение",
  history: "История"
};

/** Typo / EN / aralash segment → barqaror RU (chap panel «Операции» guruhlari). */
const SEGMENT_ALIAS_RU: Record<string, string> = {
  cash: "Касса",
  cashbox: "Касса",
  касса: "Касса",
  кассы: "Касса",
  кассия: "Касса",
  kassa: "Касса",
  clients: "Клиенты",
  client: "Клиенты",
  orders: "Заявки",
  order: "Заявки",
  plans: "Планы",
  plan: "Планы",
  staff: "Пользователи",
  users: "Пользователи",
  suppliers: "Поставщики",
  supplier: "Поставщики",
  warehouse: "Склад",
  warehouses: "Склад",
  invoices: "Накладные",
  invoice: "Накладные",
  settings: "Настройки",
  setting: "Настройки",
  dashboard: "Дашборд",
  дашбоард: "Дашборд",
  дашборд: "Дашборд",
  finance: "Финансы",
  routes: "Маршруты",
  route: "Маршруты",
  automation: "Автоматизация",
  audit: "Аудит",
  access: "Доступ",
  diagnostics: "Диагностика",
  work_slots: "Рабочее место",
  "work slots": "Рабочее место",
  reports: "Отчёт",
  report: "Отчёт",
  "отчёт": "Отчёт",
  "отчет": "Отчёт",
  pivot: "Отчёт",
  "pivot отчёты": "Отчёт",
  "pivot отчеты": "Отчёт",
  "pivot reports": "Отчёт",
  "сводные отчёты": "Отчёт",
  "конструктор отчётов": "Конструктор отчётов",
  "конструктор отчетов": "Конструктор отчётов",
  // Section sluglar (kalit fallback) — Access chap panel
  nastroyka_utverzhdayushchih: "Настройка утверждающих",
  ustanovka_planov: "Установка планов",
  konstruktor: "Конструктор отчётов",
  otchety: "Отчеты",
  raboche_mesto: "Рабочее место",
  error_logs: "Журнал ошибок",
  gps: "GPS",
  general: "Общее",
  common: "Общее",
  misc: "Разное",
  прочее: "Прочее"
};

/**
 * Access UI segmentini ruscha qiladi (modul kaliti, typo, amal nomi).
 * Masalan: `cash` → «Касса», `view` → «Просмотр», `кассия` → «Касса».
 */
export function localizeAccessSegment(segment: string): string {
  const raw = String(segment || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (SEGMENT_ALIAS_RU[lower]) return SEGMENT_ALIAS_RU[lower]!;
  if (MODULE_PREFIX_RU[lower]) return MODULE_PREFIX_RU[lower]!;
  if (ACTION_LABEL_RU[lower]) return ACTION_LABEL_RU[lower]!;
  if (/^[a-z][a-z0-9_]*$/i.test(raw) && raw.includes("_")) {
    return raw
      .split("_")
      .filter(Boolean)
      .map((p) => ACTION_LABEL_RU[p.toLowerCase()] ?? p)
      .join(" ");
  }
  return raw;
}

/** `access.grant.access.grant.foo` → `foo`. */
export function normalizeOperationKeyForDisplay(key: string): string {
  let k = key.trim();
  while (k.startsWith(ACCESS_GRANT_PREFIX)) {
    k = k.slice(ACCESS_GRANT_PREFIX.length).trim();
  }
  return k;
}

function humanizeKeySegment(segment: string): string {
  const localized = localizeAccessSegment(segment);
  if (localized !== segment.trim()) return localized;
  const mapped = ACTION_LABEL_RU[segment.toLowerCase()];
  if (mapped) return mapped;
  if (/^[a-z0-9_.-]+$/i.test(segment)) {
    return segment.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return segment;
}

function isGarbageDescription(raw: string): boolean {
  return raw.includes(`${ACCESS_GRANT_PREFIX}${ACCESS_GRANT_PREFIX}`) || raw.startsWith(ACCESS_GRANT_PREFIX);
}

/** Katalog yo‘li (`A / B / C`, `A · B · C` yoki `A - B`) → segmentlar. */
export function splitPermissionPath(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  if (t.includes(" / ")) {
    return t
      .split(/\s\/\s/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (t.includes(" · ")) {
    return t
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (/\s+-\s+/.test(t)) {
    return t
      .split(/\s+-\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [t];
}

/** Katalog yo‘li (`A / B / C` yoki `A · B · C`) → bir xil ko‘rinish. */
export function joinPermissionLabelParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" · ");
}

function splitDescriptionPath(raw: string): string[] {
  return splitPermissionPath(raw);
}

/**
 * Access UI uchun to‘liq inson o‘qiydigan yorliq: modul · bo‘lim · amal.
 * Masalan: «Склад · Остатки товаров · Просмотр» — faqat «Просмотр» emas.
 */
export function formatPermissionLabel(
  description: string | null | undefined,
  keyFallback: string
): string {
  const opKey = normalizeOperationKeyForDisplay(keyFallback);
  const known = KNOWN_OPERATION_LABEL_RU[opKey];
  if (known) return known;

  const raw = (description ?? "").trim();

  if (raw && !isGarbageDescription(raw)) {
    const parts = splitDescriptionPath(raw).map(localizeAccessSegment);
    if (parts.length > 1) return joinPermissionLabelParts(parts);
    if (raw !== opKey && !raw.includes(ACCESS_GRANT_PREFIX)) return localizeAccessSegment(raw);
  }

  if (opKey.includes(".")) {
    const parts = opKey.split(".").filter(Boolean);
    const mod = parts[0] ?? "";
    const modLabel = localizeAccessSegment(mod);
    if (parts.length >= 3) {
      const action = humanizeKeySegment(parts[parts.length - 1]!);
      const sectionParts = parts.slice(1, -1).map(humanizeKeySegment);
      return joinPermissionLabelParts([modLabel, ...sectionParts, action]);
    }
    if (parts.length === 2) {
      return joinPermissionLabelParts([modLabel, humanizeKeySegment(parts[1]!)]);
    }
    return modLabel;
  }

  return humanizeKeySegment(opKey || keyFallback);
}

/** @deprecated Prefer `formatPermissionLabel` — nomi tarixiy; endi to‘liq yo‘l qaytaradi. */
export function displayAccessDescriptionShort(
  description: string | null | undefined,
  keyFallback: string
): string {
  return formatPermissionLabel(description, keyFallback);
}
