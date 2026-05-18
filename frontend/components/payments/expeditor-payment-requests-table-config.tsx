import type { ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";

export const EXPEDITOR_PAYMENT_REQUESTS_TABLE_ID = "finance.expeditor_payment_requests.v1";

export const EXPEDITOR_PAYMENT_REQUEST_COLUMNS: ColumnDefItem[] = [
  { id: "payment_id", label: "ID оплаты" },
  { id: "paid_at", label: "Дата оплаты" },
  { id: "expeditor", label: "Экспедитор" },
  { id: "client_name", label: "Клиенты" },
  { id: "territory", label: "Территория" },
  { id: "agent", label: "Агент" },
  { id: "consignment", label: "Консигнация" },
  { id: "order_id", label: "Заказ ID" },
  { id: "amount", label: "Сумма" },
  { id: "payment_type", label: "Способ оплаты" },
  { id: "term", label: "Срок" },
  { id: "trade_direction", label: "Направление торговли" },
  { id: "note", label: "Комментарий" },
  { id: "last_change", label: "Дата последнего изменения" },
  { id: "changed_by", label: "Кто изменил" }
];

export const DEFAULT_EXPEDITOR_PAYMENT_REQUEST_COLUMN_ORDER = EXPEDITOR_PAYMENT_REQUEST_COLUMNS.map((c) => c.id);

export const DEFAULT_HIDDEN_EXPEDITOR_PAYMENT_REQUEST_COLUMNS = ["term", "last_change", "changed_by"] as const;
