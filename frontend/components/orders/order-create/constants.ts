/** Order create workspace — constants and lookup maps. */
import { MAX_RETURN_PHYSICAL_UNITS_PER_DOCUMENT } from "@/lib/return-limits";

export const fieldClass =
  "flex h-10 w-full min-w-0 max-w-none rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const MAX_POLKI_RETURN_QTY = MAX_RETURN_PHYSICAL_UNITS_PER_DOCUMENT;

export const POLKI_TABLE_COLS = 5;

export const POLKI_TRADE_DIRECTION_OPTS = [
  { value: "", label: "— Направление торговли" },
  { value: "mal-dev", label: "MAL-DEV" },
  { value: "wholesale", label: "Опт / склад" }
];

export const POLKI_SKIDKA_OPTS = [
  { value: "none", label: "Без скидки" },
  { value: "auto", label: "Авто" },
  { value: "line", label: "По строкам (API)" }
];

export const POLKI_PRICE_TYPE_LABEL_RU: Record<string, string> = {
  retail: "Розница",
  wholesale: "Опт",
  naqd: "Наличные",
  terminal: "Терминал",
  perechisleniye: "Перечисление",
  NAQD_PUL: "Наличные",
  TERMINAL: "Терминал",
  PERECHISLENIYE: "Перечисление",
  old_prices: "Старые цены",
  OLD_PRICES: "Старые цены"
};

export const ORDER_STATUS_LABEL_RU: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  picking: "Комплектация",
  delivering: "Доставка",
  delivered: "Доставлен",
  returned: "Возвращён",
  cancelled: "Отменён"
};
