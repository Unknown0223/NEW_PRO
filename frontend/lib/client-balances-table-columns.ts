/** Балансы клиентов — ustunlar (useUserTablePrefs + TableColumnSettingsDialog). */

export const CLIENT_BALANCES_CLIENTS_TABLE_ID = "client-balances.clients.v2";
export const CLIENT_BALANCES_DELIVERY_TABLE_ID = "client-balances.clients_delivery.v2";
export const CLIENT_BALANCES_LEGACY_TABLE_ID = "client-balances.clients_legacy.v1";
export const CLIENT_BALANCES_CONSIGNMENT_TABLE_ID = "client-balances.clients_consignment.v1";
export const CLIENT_BALANCES_AGENTS_TABLE_ID = "client-balances.agents.v1";

/** «По клиентам» / «По доставке»da default yashirin — alohida «Долг старого агента» tabida. */
export const CLIENT_BALANCES_DEFAULT_HIDDEN = ["legacy_debt", "current_debt"] as const;

export const CLIENT_BALANCES_COLUMN_DEFS = [
  { id: "client_id", label: "Ид клиента" },
  { id: "name", label: "Клиент" },
  { id: "agent_name", label: "Агент" },
  { id: "agent_code", label: "Код агента" },
  { id: "supervisor_name", label: "Супервайзер" },
  { id: "legal_name", label: "Название фирмы" },
  { id: "trade_direction", label: "Направление торговли" },
  { id: "inn", label: "ИНН" },
  { id: "phone", label: "Телефон" },
  { id: "license_until", label: "Срок" },
  { id: "days_overdue", label: "Дни просрочки" },
  { id: "last_order_at", label: "Дата последней доставки заказа" },
  { id: "last_payment_at", label: "Дата последней оплаты" },
  { id: "days_since_payment", label: "Дни с последней оплаты" },
  { id: "balance", label: "Общий" },
  { id: "legacy_debt", label: "Долг старого агента" },
  { id: "current_debt", label: "Долг текущего агента" }
] as const;

export const CLIENT_BALANCES_DELIVERY_COLUMN_DEFS = [
  { id: "order_id", label: "Заказ (id)" },
  ...CLIENT_BALANCES_COLUMN_DEFS.map((c) =>
    c.id === "last_order_at" ? { id: c.id, label: "Дата доставки заказа" } : { id: c.id, label: c.label }
  )
] as const;

/** Ish ro‘yxati: eski qarz — agent nomlari alohida ustun. */
export const CLIENT_BALANCES_LEGACY_COLUMN_DEFS = [
  { id: "client_id", label: "Ид клиента" },
  { id: "name", label: "Клиент" },
  { id: "agent_name", label: "Текущий агент" },
  { id: "legacy_agent_names", label: "Старый агент" },
  { id: "legacy_debt", label: "Долг старого агента" },
  { id: "current_debt", label: "Долг текущего агента" },
  { id: "balance", label: "Общий" },
  { id: "days_overdue", label: "Дни просрочки" },
  { id: "last_payment_at", label: "Дата последней оплаты" },
  { id: "days_since_payment", label: "Дни с последней оплаты" },
  { id: "phone", label: "Телефон" },
  { id: "trade_direction", label: "Направление торговли" }
] as const;

/** «По консигнации» — alohida hisob (долг / оплачено / срок). */
export const CLIENT_BALANCES_CONSIGNMENT_COLUMN_DEFS = [
  { id: "client_id", label: "Ид клиента" },
  { id: "name", label: "Клиент" },
  { id: "agent_name", label: "Агент" },
  { id: "agent_code", label: "Код агента" },
  { id: "supervisor_name", label: "Супервайзер" },
  { id: "legal_name", label: "Название фирмы" },
  { id: "trade_direction", label: "Направление торговли" },
  { id: "inn", label: "ИНН" },
  { id: "phone", label: "Телефон" },
  { id: "due_date", label: "Срок" },
  { id: "overdue_days", label: "Дни просрочки" },
  { id: "total_debt", label: "Общий долг" },
  { id: "total_paid", label: "Общее оплачено" },
  { id: "balance", label: "Общий баланс" }
] as const;

/** «По агентам» — faqat aktiv; legacy joriy agent ostida. */
export const CLIENT_BALANCES_AGENTS_COLUMN_DEFS = [
  { id: "agent_name", label: "Агент" },
  { id: "agent_code", label: "Код" },
  { id: "clients_count", label: "Клиентов" },
  { id: "balance", label: "Общий" },
  { id: "legacy_debt", label: "Долг старого агента" },
  { id: "current_debt", label: "Долг текущего агента" },
  { id: "is_active", label: "Статус" }
] as const;

export type ClientBalancesColumnId =
  | (typeof CLIENT_BALANCES_COLUMN_DEFS)[number]["id"]
  | "order_id"
  | "legacy_agent_names"
  | (typeof CLIENT_BALANCES_CONSIGNMENT_COLUMN_DEFS)[number]["id"]
  | (typeof CLIENT_BALANCES_AGENTS_COLUMN_DEFS)[number]["id"];

export const CLIENT_BALANCES_COLUMN_IDS = CLIENT_BALANCES_COLUMN_DEFS.map((c) => c.id);
export const CLIENT_BALANCES_DELIVERY_COLUMN_IDS = CLIENT_BALANCES_DELIVERY_COLUMN_DEFS.map((c) => c.id);
export const CLIENT_BALANCES_LEGACY_COLUMN_IDS = CLIENT_BALANCES_LEGACY_COLUMN_DEFS.map((c) => c.id);
export const CLIENT_BALANCES_CONSIGNMENT_COLUMN_IDS = CLIENT_BALANCES_CONSIGNMENT_COLUMN_DEFS.map(
  (c) => c.id
);
export const CLIENT_BALANCES_AGENTS_COLUMN_IDS = CLIENT_BALANCES_AGENTS_COLUMN_DEFS.map((c) => c.id);

/** API sort key for column id (undefined = not sortable). */
export const CLIENT_BALANCES_SORT_KEY: Partial<Record<ClientBalancesColumnId, string>> = {
  order_id: "order_id",
  client_id: "client_id",
  name: "name",
  agent_name: "agent_name",
  agent_code: "agent_code",
  clients_count: "clients_count",
  supervisor_name: "supervisor",
  legal_name: "legal_name",
  trade_direction: "trade_direction",
  inn: "inn",
  phone: "phone",
  license_until: "license_until",
  days_overdue: "days_overdue",
  last_order_at: "last_order_at",
  last_payment_at: "last_payment_at",
  days_since_payment: "days_since_payment",
  balance: "balance",
  legacy_debt: "legacy_debt",
  current_debt: "current_debt",
  due_date: "due_date",
  overdue_days: "overdue_days",
  total_debt: "total_debt",
  total_paid: "total_paid"
};

export function clientBalancesColLabel(
  id: string,
  variant: "clients" | "delivery" | "legacy" | "consignment" | "agents" = "clients"
): string {
  const defs =
    variant === "delivery"
      ? CLIENT_BALANCES_DELIVERY_COLUMN_DEFS
      : variant === "legacy"
        ? CLIENT_BALANCES_LEGACY_COLUMN_DEFS
        : variant === "consignment"
          ? CLIENT_BALANCES_CONSIGNMENT_COLUMN_DEFS
          : variant === "agents"
            ? CLIENT_BALANCES_AGENTS_COLUMN_DEFS
            : CLIENT_BALANCES_COLUMN_DEFS;
  return defs.find((c) => c.id === id)?.label ?? id;
}

/** Excel: amount + optional agent name in one cell. */
export function formatDebtExcelCell(amount: string | null | undefined, agentNames?: string | null): string {
  const a = amount ?? "0";
  const n = agentNames?.trim();
  return n ? `${a} (${n})` : a;
}
