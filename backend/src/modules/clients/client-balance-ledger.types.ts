import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

export type ClientBalancePaymentTypeSummary = {
  label: string;
  amount: string;
};

export type ClientLedgerRow = {
  row_kind: "order" | "payment";
  sort_at: string;
  order_id: number | null;
  payment_id: number | null;
  order_number: string | null;
  type_label: string;
  debt_amount: string | null;
  payment_amount: string | null;
  payment_type: string | null;
  agent_name: string | null;
  expeditor_name: string | null;
  is_consignment: boolean | null;
  cash_desk_name: string | null;
  note: string | null;
  created_by_login: string | null;
  entry_kind: string | null;
  /** 1 — строка заказа/долга, 2 — оплата или расход (как в шаблоне Excel «Общий»). */
  type_code: 1 | 2;
  /** Код вида операции: 7 — заказ, 1 — оплата, 2 — расход клиента (шаблон «Подробно»). */
  operation_type_code: string;
  /** «Заказ» для заказов; для оплат пусто. */
  order_kind_label: string | null;
  /** Фиксированный текст для заказов (шаблон). */
  comment_primary: string | null;
  /** Примечание из документа (заказ/платёж). */
  comment_transaction: string | null;
  /** Кто создал / ответственный для отображения (как в шаблоне). */
  created_by_display: string | null;
  /** Нарастающий баланс после строки (только при ledger_detail=1). */
  balance_after: string | null;
  /**
   * Строка оплаты/расхода, привязанная к заказу: способ оплаты из заказа (как при оформлении).
   * Показывается в UI, если отличается от способа у самого платежа.
   */
  order_payment_method_label: string | null;
};

export type AgentBalanceCard = {
  agent_id: number | null;
  agent_name: string;
  agent_code: string | null;
  remaining_on_orders: string;
  payment_by_type: ClientBalancePaymentTypeSummary[];
  /** Суммы как в таблице «Общее»: долг и оплата (по строкам ведомости с теми же фильтрами даты/поиска/kind). */
  ledger_general_debt_total: string;
  ledger_general_payment_total: string;
};

export type ClientBalanceLedgerResponse = {
  client: {
    id: number;
    name: string;
    phone: string | null;
    client_code: string | null;
    territory_label: string | null;
    agent_id: number | null;
  };
  /** Сальдо в `client_balances` (платежи/расходы/корректировки; суммы заказов сюда не входят). */
  account_balance: string;
  /**
   * Как колонки «Оплата» и «Долг» в таблице ведомости: оплаты − долг для тех же фильтров
   * (дата, поиск, тип строк, агенты).
   */
  ledger_net_balance: string;
  summary_payment_by_type: ClientBalancePaymentTypeSummary[];
  agent_cards: AgentBalanceCard[];
  rows: ClientLedgerRow[];
  total: number;
  page: number;
  limit: number;
};

export type ClientLedgerQuery = {
  page: number;
  limit: number;
  date_from?: Date | null;
  date_to_end?: Date | null;
  search?: string | null;
  /** all | debt (заказы + расход) | payment */
  ledger_kind?: "all" | "debt" | "payment";
  /** Фильтр таблицы: только заказы/платежи этого агента (устарело, см. filter_agent_ids) */
  filter_agent_id?: number | null;
  /** Несколько агентов: строка попадает, если заказ/привязка платежа к любому из id */
  filter_agent_ids?: number[];
  /** Только строки без агента (agent_id IS NULL); можно вместе с filter_agent_ids */
  filter_no_agent?: boolean;
  /** Подробный режим: «Баланс (после)» и поля под Excel «Подробно». */
  ledger_detail?: boolean;
};

export type UnionRaw = {
  row_kind: string;
  sort_at: Date;
  order_id: number | null;
  payment_id: number | null;
  order_number: string | null;
  debt_amount: Prisma.Decimal | null;
  payment_amount: Prisma.Decimal | null;
  payment_type: string | null;
  is_consignment: boolean | null;
  agent_name: string | null;
  expeditor_name: string | null;
  cash_desk_name: string | null;
  note: string | null;
  created_by_login: string | null;
  entry_kind: string | null;
  balance_after?: Prisma.Decimal | null;
  /** Сырой `orders.payment_method_ref` для строки платежа (если есть заказ). */
  order_payment_method_ref: string | null;
};
