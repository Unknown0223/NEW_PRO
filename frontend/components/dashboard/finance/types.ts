import type { FinanceDateTypeUi } from "@/components/dashboard/finance/finance-date-type";

export type FinanceFilterDraft = {
  /** Shablon: заказ / отправка / доставка / создание → API `date_type` build-finance-query da. */
  date_type: FinanceDateTypeUi;
  from: string;
  to: string;
  payment_types: string[];
  agent_ids: string[];
  supervisor_ids: string[];
  trade_directions: string[];
  client_categories: string[];
  category_ids: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  statuses: string[];
};

export type { QuickRangeKey } from "@/components/dashboard/shared/quick-range";

export type FinanceSummaryBlock = {
  total_sales_sum: string;
  total_payments_sum: string;
  total_returns_sum: string;
  net_sales_sum: string;
  outstanding_debt_sum: string;
  debt_ratio_pct: number;
};

export type FinanceCategoryRow = {
  category: string;
  sales_sum: string;
  sales_share_pct: number;
  order_count: number;
};

export type FinancePaymentTypeRow = {
  payment_type: string;
  amount: string;
  share_pct: number;
};

export type FinanceTerritoryDebtRow = {
  territory: string;
  debt_sum: string;
  debtors_count: number;
};

export type FinanceBalanceBlock = {
  total_balance: string;
  debt_clients_count: number;
  credit_clients_count: number;
};

export type FinancePeriodRow = {
  period: string;
  debt_sum: string;
  payment_sum: string;
};

export type FinanceClientDebtRow = {
  client_id: number;
  client_name: string;
  agent_name: string | null;
  supervisor_name: string | null;
  territory: string | null;
  ledger_balance: string;
  delivered_debt: string;
  effective_balance: string;
};

export type FinanceDashboardSnapshot = {
  filters: FinanceFilterDraft;
  summary: FinanceSummaryBlock;
  category_analytics: FinanceCategoryRow[];
  payment_type_analytics: FinancePaymentTypeRow[];
  territory_debts: FinanceTerritoryDebtRow[];
  general_balance: FinanceBalanceBlock;
  debt_and_payment_by_period: FinancePeriodRow[];
  clients_debt_list: FinanceClientDebtRow[];
};

export type FinanceSummaryPayload = Omit<
  FinanceDashboardSnapshot,
  "territory_debts" | "clients_debt_list"
>;

export type FinanceDebtsPayload = {
  territory_debts: FinanceTerritoryDebtRow[];
  clients_debt_list: FinanceClientDebtRow[];
  clients_total: number;
  page: number;
  limit: number;
};
