import type { OrderListRow } from "@/components/orders/order-detail-view";
import { formatOrderListDateTime } from "@/lib/format-order-list-datetime";
import { orderListStatusLabel } from "@/lib/order-list-status-labels";
import { formatNumberGrouped } from "@/lib/format-numbers";

/** Zakazlar ro‘yxati — `useUserTablePrefs` / TableColumnSettingsDialog */
export const ORDERS_LIST_TABLE_ID = "orders.list.v1";

/** To‘liq shablon ustunlari tartibi */
export const ORDER_LIST_FULL_COLUMN_ORDER = [
  "number",
  "source_order_number",
  "request_source",
  "order_type",
  "created_at",
  "expected_ship_date",
  "shipped_at",
  "delivered_at",
  "returned_at",
  "list_created_at",
  "status",
  "client_name",
  "client_legal_name",
  "client_id",
  "client_phone",
  "client_inn",
  "qty",
  "volume_m3",
  "total_sum",
  "bonus_sum",
  "cumulative_bonus",
  "discount_sum",
  "balance",
  "debt",
  "price_type",
  "warehouse_name",
  "agent_name",
  "agent_code",
  "region",
  "city",
  "zone",
  "expeditors",
  "client_address",
  "order_location",
  "consignment_due_date",
  "is_consignment",
  "sales_channel",
  "agent_trade_direction",
  "day",
  "request_type_ref",
  "created_by",
  "comment",
  "created_by_role"
] as const;

export const ORDER_LIST_COLUMN_IDS = [...ORDER_LIST_FULL_COLUMN_ORDER] as const;

/** Barcha ustunlar ko‘rinadi (to‘liq jadval). */
export const ORDER_LIST_DEFAULT_HIDDEN_COLUMN_IDS: readonly string[] = [];

const LABELS: Record<(typeof ORDER_LIST_COLUMN_IDS)[number], string> = {
  number: "№",
  source_order_number: "Исходный заказ",
  request_source: "Источник заявки",
  order_type: "Тип",
  created_at: "Дата заказа",
  expected_ship_date: "Ожидаемая дата отгрузки",
  shipped_at: "Дата отгрузки",
  delivered_at: "Дата доставки",
  returned_at: "Дата возврата",
  list_created_at: "Дата создания",
  status: "Статус",
  client_name: "Клиент",
  client_legal_name: "Юр. наз. клиента",
  client_id: "Ид клиента",
  client_phone: "Телефон",
  client_inn: "ИНН",
  qty: "Кол-во",
  volume_m3: "Объем",
  total_sum: "Сумма",
  bonus_sum: "Бонус",
  cumulative_bonus: "Накопительный бонус",
  discount_sum: "Скидка",
  balance: "Баланс",
  debt: "Долг",
  price_type: "Тип цены",
  warehouse_name: "Склад",
  agent_name: "Агент",
  agent_code: "Код агента",
  region: "Область",
  city: "Город",
  zone: "Зона",
  expeditors: "Экспедиторы",
  client_address: "Адрес",
  order_location: "Локация заказа",
  consignment_due_date: "Консигнация (срок)",
  is_consignment: "Консигнация",
  sales_channel: "Канал продаж",
  agent_trade_direction: "Направление торговли",
  day: "День",
  request_type_ref: "Примечание",
  created_by: "Кто создал",
  comment: "Комментарий",
  created_by_role: "Роль(кто создал)"
};

export const ORDER_LIST_COLUMNS = ORDER_LIST_COLUMN_IDS.map((id) => ({
  id,
  label: LABELS[id]
}));

/** Uzun matn ustunlari — bitta qator, qator balandligi oshmasin. */
export const ORDER_LIST_TRUNCATE_COLUMN_IDS = new Set<string>([
  "client_name",
  "client_legal_name",
  "agent_name",
  "warehouse_name",
  "expeditors",
  "region",
  "city",
  "zone",
  "client_address",
  "order_location",
  "sales_channel",
  "agent_trade_direction",
  "created_by",
  "comment",
  "price_type",
  "request_type_ref"
]);

const ORDER_LIST_COLUMN_TH_CLASS: Partial<Record<string, string>> = {
  client_name: "min-w-[12rem] max-w-[12rem]",
  client_legal_name: "min-w-[14rem] max-w-[14rem]",
  client_address: "min-w-[14rem] max-w-[14rem]",
  order_location: "min-w-[12rem] max-w-[12rem]",
  comment: "min-w-[12rem] max-w-[12rem]",
  warehouse_name: "min-w-[10rem] max-w-[10rem]",
  agent_name: "min-w-[10rem] max-w-[10rem]",
  expeditors: "min-w-[10rem] max-w-[10rem]"
};

const ORDER_LIST_COLUMN_TD_CLASS: Partial<Record<string, string>> = {
  client_name: "max-w-[12rem] whitespace-nowrap overflow-hidden",
  client_legal_name: "max-w-[14rem] whitespace-nowrap overflow-hidden",
  client_address: "max-w-[14rem] whitespace-nowrap overflow-hidden",
  order_location: "max-w-[12rem] whitespace-nowrap overflow-hidden",
  comment: "max-w-[12rem] whitespace-nowrap overflow-hidden",
  warehouse_name: "max-w-[10rem] whitespace-nowrap overflow-hidden",
  agent_name: "max-w-[10rem] whitespace-nowrap overflow-hidden",
  expeditors: "max-w-[10rem] whitespace-nowrap overflow-hidden"
};

const ORDER_LIST_COLUMN_TD_DEFAULT = "max-w-[9rem] whitespace-nowrap overflow-hidden";
const ORDER_LIST_COLUMN_TH_DEFAULT = "min-w-[9rem] max-w-[9rem]";

export function orderListColumnThClass(colId: string): string | undefined {
  if (!ORDER_LIST_TRUNCATE_COLUMN_IDS.has(colId)) return undefined;
  return ORDER_LIST_COLUMN_TH_CLASS[colId] ?? ORDER_LIST_COLUMN_TH_DEFAULT;
}

export function orderListColumnTdClass(colId: string): string | undefined {
  if (!ORDER_LIST_TRUNCATE_COLUMN_IDS.has(colId)) return undefined;
  return ORDER_LIST_COLUMN_TD_CLASS[colId] ?? ORDER_LIST_COLUMN_TD_DEFAULT;
}

export function orderListTruncateCellClass(colId: string): string {
  return ORDER_LIST_TRUNCATE_COLUMN_IDS.has(colId) ? "block min-w-0 truncate" : "";
}

/** API: musbat qoldiq — UI/Excel: mijoz qarzi sifatida manfiy ko‘rsatiladi. */
export function formatOrderListDebtAsClientLiability(debt: string | null | undefined): string {
  if (debt == null) return "";
  const t = String(debt)
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/\u2212/g, "-")
    .replace(/−/g, "-")
    .replace(/,/g, ".");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatNumberGrouped(String(-n), { maxFractionDigits: 2 });
}

function requestSourceLabel(o: OrderListRow): string {
  if (o.request_type_ref?.trim()) return o.request_type_ref.trim();
  if (o.creation_channel === "mobile") return "Телефон (агент)";
  if (o.creation_channel === "web") return "Веб";
  return "";
}

export function orderListExportCell(o: OrderListRow, colId: string): string {
  switch (colId) {
    case "number":
      return o.number;
    case "source_order_number":
      return (o.source_order_numbers ?? []).join(", ");
    case "request_source":
      return requestSourceLabel(o);
    case "order_type":
      return o.order_type ?? "";
    case "created_at":
    case "list_created_at":
      return formatOrderListDateTime(o.created_at);
    case "expected_ship_date":
      return formatOrderListDateTime(o.expected_ship_date);
    case "shipped_at":
      return formatOrderListDateTime(o.shipped_at);
    case "delivered_at":
      return formatOrderListDateTime(o.delivered_at);
    case "returned_at":
      return formatOrderListDateTime(o.returned_at);
    case "status":
      return orderListStatusLabel(o.status, o.order_type);
    case "client_name":
      return o.client_name;
    case "client_legal_name":
      return o.client_legal_name ?? "";
    case "client_id":
      return String(o.client_id);
    case "client_phone":
      return o.client_phone ?? "";
    case "client_inn":
      return o.client_inn ?? "";
    case "qty":
      return formatNumberGrouped(o.qty, { maxFractionDigits: 3 });
    case "volume_m3":
      return o.volume_m3
        ? formatNumberGrouped(o.volume_m3, { maxFractionDigits: 4 })
        : "";
    case "total_sum":
      return formatNumberGrouped(o.total_sum, { maxFractionDigits: 2 });
    case "bonus_sum":
      return formatNumberGrouped(o.bonus_sum ?? "0", { maxFractionDigits: 2 });
    case "cumulative_bonus":
      return o.cumulative_bonus
        ? formatNumberGrouped(o.cumulative_bonus, { maxFractionDigits: 2 })
        : "";
    case "discount_sum":
      return formatNumberGrouped(o.discount_sum ?? "0", { maxFractionDigits: 2 });
    case "balance":
      return o.balance == null ? "" : formatNumberGrouped(o.balance, { maxFractionDigits: 2 });
    case "debt":
      return formatOrderListDebtAsClientLiability(o.debt);
    case "price_type":
      return o.price_type ?? "";
    case "warehouse_name":
      return o.warehouse_name ?? "";
    case "agent_name":
      return o.agent_name ?? "";
    case "agent_code":
      return o.agent_code ?? "";
    case "expeditors":
      return o.expeditor_display ?? o.expeditors ?? "";
    case "region":
      return o.region ?? "";
    case "city":
      return o.city ?? "";
    case "zone":
      return o.zone ?? "";
    case "client_address":
      return o.client_address ?? "";
    case "order_location":
      return o.order_location ?? "";
    case "consignment_due_date":
      return formatOrderListDateTime(o.consignment_due_date);
    case "is_consignment":
      return o.is_consignment ? "Да" : "Нет";
    case "sales_channel":
      return o.sales_channel ?? "";
    case "agent_trade_direction":
      return o.agent_trade_direction ?? "";
    case "day":
      return o.day ?? "";
    case "request_type_ref":
      return o.request_type_ref ?? "";
    case "created_by":
      return o.created_by ?? "";
    case "comment":
      return o.comment ?? "";
    case "created_by_role":
      return o.created_by_role ?? "";
    default:
      return "";
  }
}
