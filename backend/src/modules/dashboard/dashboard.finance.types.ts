export type FinanceDashboardFilters = {
  date_type: "created_at" | "shipped_at" | "delivered_at";
  from: string;
  to: string;
  payment_types: string[];
  agent_ids: number[];
  supervisor_ids: number[];
  trade_directions: string[];
  client_categories: string[];
  category_ids: number[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  statuses: string[];
};

export type FinanceSummaryBlock = {
  total_sales_sum: string;
  total_payments_sum: string;
  total_returns_sum: string;
  net_sales_sum: string;
  outstanding_debt_sum: string;
  debt_ratio_pct: number;
};

/** NEW_PRO finance UI — cash P&L / kassa / operatsiyalar (sales-debt snapshotdan alohida). */
export type FinanceProOpsBlock = {
  total_income: string;
  total_expense: string;
  total_profit: string;
  accounts_balance: string;
  income_change_pct: number | null;
  expense_change_pct: number | null;
  profit_change_pct: number | null;
  balance_change_pct: number | null;
  income_spark: number[];
  expense_spark: number[];
  profit_spark: number[];
  balance_spark: number[];
  cashflow_by_period: { period: string; income: string; expense: string; profit: string }[];
  income_categories: { name: string; amount: string; pct: number; color: string }[];
  expense_categories: { name: string; amount: string; pct: number; color: string }[];
  recent_transactions: {
    id: number;
    date: string;
    type: "income" | "expense" | "transfer";
    description: string;
    amount: string;
    status: string;
    account: string;
    category: string;
  }[];
  accounts: { id: number; name: string; amount: string; type: string; color: string }[];
  scheduled_payments: {
    id: number;
    date: string;
    name: string;
    category: string;
    account: string;
    amount: string;
    status: "pending" | "paid";
  }[];
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

export type FinancePeriodBalanceBlock = {
  uzs: string;
  cash: string;
  transfer: string;
  terminal: string;
  tenge: string;
};

export type FinancePeriodGranularity = "day" | "week" | "month";

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
  filters: FinanceDashboardFilters;
  summary: FinanceSummaryBlock;
  pro?: FinanceProOpsBlock;
  category_analytics: FinanceCategoryRow[];
  payment_type_analytics: FinancePaymentTypeRow[];
  territory_debts: FinanceTerritoryDebtRow[];
  general_balance: FinanceBalanceBlock;
  debt_and_payment_by_period: FinancePeriodRow[];
  period_balance: FinancePeriodBalanceBlock;
  period_granularity: FinancePeriodGranularity;
  clients_debt_list: FinanceClientDebtRow[];
};
