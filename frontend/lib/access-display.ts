const ACCESS_GRANT_PREFIX = "access.grant.";

const KNOWN_OPERATION_LABEL_RU: Record<string, string> = {
  "access.manage": "Доступ: управление",
  "access.upravlenie.view": "Доступ: просмотр раздела",
  "access.upravlenie.update": "Доступ: изменение прав",
  "access.upravlenie.history": "Доступ: история изменений",
  "audit.log.view": "Журнал аудита: просмотр",
  "audit.log.copy": "Журнал аудита: выгрузка",
  "audit.view": "Аудит: просмотр"
};

const MODULE_PREFIX_RU: Record<string, string> = {
  access: "Доступ",
  audit: "Аудит",
  orders: "Заявки",
  clients: "Клиенты",
  warehouse: "Склад",
  cashbox: "Касса",
  dashboard: "Дашборд",
  staff: "Пользователи",
  settings: "Настройки",
  automation: "Автоматизация"
};

const ACTION_LABEL_RU: Record<string, string> = {
  view: "Просмотр",
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  copy: "Выгрузка",
  activate: "Активировать",
  deactivate: "Деактивировать",
  manage: "Управление",
  approve: "Утверждение",
  import: "Импорт",
  export: "Экспорт",
  assign: "Назначение",
  status: "Статус"
};

/** `access.grant.access.grant.foo` → `foo`. */
export function normalizeOperationKeyForDisplay(key: string): string {
  let k = key.trim();
  while (k.startsWith(ACCESS_GRANT_PREFIX)) {
    k = k.slice(ACCESS_GRANT_PREFIX.length).trim();
  }
  return k;
}

function humanizeKeyTail(key: string): string {
  const tail = key.split(".").pop()?.trim() ?? key;
  const mapped = ACTION_LABEL_RU[tail.toLowerCase()];
  if (mapped) return mapped;
  if (/^[a-z0-9_.-]+$/i.test(tail)) {
    return tail.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return tail;
}

function isGarbageDescription(raw: string): boolean {
  return raw.includes(`${ACCESS_GRANT_PREFIX}${ACCESS_GRANT_PREFIX}`) || raw.startsWith(ACCESS_GRANT_PREFIX);
}

/** «Описание», «Раздел»: «A / B / C» — faqat oxirgi qism. Texnik kalitlar → tushunarli matn. */
export function displayAccessDescriptionShort(
  description: string | null | undefined,
  keyFallback: string
): string {
  const opKey = normalizeOperationKeyForDisplay(keyFallback);
  const known = KNOWN_OPERATION_LABEL_RU[opKey];
  if (known) return known;

  const raw = (description ?? "").trim();

  if (raw && !isGarbageDescription(raw)) {
    const bySlash = raw
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    if (bySlash.length > 1) return bySlash[bySlash.length - 1]!;
    if (raw !== opKey && !raw.includes(ACCESS_GRANT_PREFIX)) return raw;
  }

  if (opKey.includes(".")) {
    const parts = opKey.split(".");
    const mod = parts[0] ?? "";
    const modLabel = MODULE_PREFIX_RU[mod];
    const action = humanizeKeyTail(opKey);
    if (modLabel) {
      const mid = parts.slice(1, -1).join(".");
      const midLabel = mid ? humanizeKeyTail(mid) : null;
      if (midLabel && midLabel !== action) return `${modLabel}: ${midLabel} — ${action}`;
      return `${modLabel}: ${action}`;
    }
    const tail = action;
    const section = parts.length >= 2 ? humanizeKeyTail(parts.slice(-2).join(".")) : tail;
    if (section !== tail && tail.length <= 24) {
      return `${section}: ${tail}`;
    }
    return tail;
  }

  return humanizeKeyTail(opKey || keyFallback);
}
