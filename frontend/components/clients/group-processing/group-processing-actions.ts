/** Групповые обработки клиентов — идентификаторы действий */

export type GroupProcessingActionId =
  | "team"
  | "client_attrs"
  | "active"
  | "territory"
  | "category"
  | "type_format"
  | "sales_channel"
  | "ops"
  | "warehouse_cash"
  | "allow_order_with_debt"
  | "misc"
  | "product_category"
  | "client_code"
  | "credit_limit"
  | "price_type"
  | "tags"
  | "map";

export type GroupProcessingActionDef = {
  id: GroupProcessingActionId;
  label: string;
  description: string;
  kind: "patch" | "navigate";
  hiddenInMenu?: boolean;
};

export const GROUP_PROCESSING_ACTIONS: GroupProcessingActionDef[] = [
  {
    id: "team",
    label: "Команда / маршрут",
    description: "Агент, дни визита и экспедитор",
    kind: "patch"
  },
  {
    id: "client_attrs",
    label: "Активность · Категория · Тип/формат · Канал продаж",
    description: "Текущие значения + массовое или построчное изменение",
    kind: "patch"
  },
  {
    id: "active",
    label: "Активность",
    description: "Активный / неактивный",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "territory",
    label: "Территория",
    description: "Зона → Область → Город (дерево настроек)",
    kind: "patch"
  },
  {
    id: "category",
    label: "Категория",
    description: "Категория клиента",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "type_format",
    label: "Тип + формат",
    description: "Тип и формат клиента",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "sales_channel",
    label: "Канал продаж",
    description: "Канал продаж",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "ops",
    label: "Склад · Касса",
    description: "Привязка склада и кассы",
    kind: "patch"
  },
  {
    id: "warehouse_cash",
    label: "Склад + касса",
    description: "Привязка склада и кассы",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "allow_order_with_debt",
    label: "Заказ при наличии долга",
    description: "Обычный заказ, консигнация и консигнация в долг",
    kind: "patch"
  },
  {
    id: "misc",
    label: "Товар · Лимит · Цена · Теги",
    description: "Категория товара, кредитный лимит, тип цены, теги",
    kind: "patch"
  },
  {
    id: "product_category",
    label: "Категория товара",
    description: "Категория продаваемого товара",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "client_code",
    label: "Код",
    description: "Не для групповой обработки (уникален)",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "credit_limit",
    label: "Кредитный лимит",
    description: "Изменение кредитного лимита",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "price_type",
    label: "Тип цены",
    description: "Тип цены по умолчанию",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "tags",
    label: "Теги",
    description: "Назначение / снятие тегов",
    kind: "patch",
    hiddenInMenu: true
  },
  {
    id: "map",
    label: "Показать на карте",
    description: "Открыть выбранных на карте",
    kind: "navigate"
  }
];

export const GROUP_PROCESSING_MENU_ACTIONS = GROUP_PROCESSING_ACTIONS.filter((a) => !a.hiddenInMenu);

export const GROUP_PROCESSING_ATTRS_ALIASES = new Set<GroupProcessingActionId>([
  "client_attrs",
  "active",
  "category",
  "type_format",
  "sales_channel"
]);

export const GROUP_PROCESSING_OPS_ALIASES = new Set<GroupProcessingActionId>([
  "ops",
  "warehouse_cash"
]);

/** Заказ при наличии долга / консигнация */
export const GROUP_PROCESSING_DEBT_ALIASES = new Set<GroupProcessingActionId>([
  "allow_order_with_debt"
]);

export const GROUP_PROCESSING_MISC_ALIASES = new Set<GroupProcessingActionId>([
  "misc",
  "product_category",
  "client_code",
  "credit_limit",
  "price_type",
  "tags"
]);

export const GROUP_PROCESSING_IDS_STORAGE_KEY = "salec:group-processing-ids";
export const CLIENTS_LIST_SELECTED_IDS_KEY = "salec:clients-list-selected-ids";

const MAX_STORED_CLIENT_IDS = 5000;

export function clientsListSelectedStorageKey(tenantSlug: string): string {
  return `${CLIENTS_LIST_SELECTED_IDS_KEY}:${tenantSlug}`;
}

export function readStoredClientIds(storageKey: string): number[] {
  try {
    if (typeof sessionStorage === "undefined") return [];
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_STORED_CLIENT_IDS);
  } catch {
    return [];
  }
}

export function writeStoredClientIds(storageKey: string, ids: Iterable<number>): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const list = [
      ...new Set(
        [...ids]
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ].slice(0, MAX_STORED_CLIENT_IDS);
    if (list.length === 0) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function rememberClientsListSelection(
  tenantSlug: string | null | undefined,
  ids: Iterable<number>
): void {
  if (!tenantSlug) return;
  writeStoredClientIds(clientsListSelectedStorageKey(tenantSlug), ids);
}

export function goToClientsKeepingSelection(
  push: (href: string) => void,
  tenantSlug: string | null | undefined,
  ids: Iterable<number>
): void {
  rememberClientsListSelection(tenantSlug, ids);
  push("/clients");
}
