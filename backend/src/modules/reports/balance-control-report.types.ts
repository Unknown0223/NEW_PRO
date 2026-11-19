/** SalesDoc `/clients/transactions` → «Контроль балансов» (flat). */

export type BalanceControlBalanceFilter = "all" | "debt" | "credit" | "zero";

export type BalanceDebtFlag = "debt" | "credit" | "zero";

export type BalanceControlReportFilters = {
  from: string;
  to: string;
  agent_ids: number[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  balance_filter: BalanceControlBalanceFilter;
  search?: string;
  page: number;
  limit: number;
};

export type BalanceControlReportRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  agent_name: string;
  client_category: string;
  territory: string;
  balance: string;
  period_sales: string;
  period_payments: string;
  debt_flag: BalanceDebtFlag;
  debt_flag_label: string;
};

export type BalanceControlReportTotals = {
  client_count: number;
  balance_sum: string;
  period_sales_sum: string;
  period_payments_sum: string;
};