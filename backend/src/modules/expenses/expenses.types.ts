export type ExpenseListQuery = {
  page: number;
  limit: number;
  status?: string;
  expense_type?: string;
  agent_id?: number | null;
  warehouse_id?: number | null;
  from?: Date | string;
  to?: Date | string;
  /** true — faqat arxiv (deleted_at bor) */
  archive?: boolean;
};

export type ExpenseListRow = {
  id: number;
  expense_type: string;
  agent_id: number | null;
  agent_name: string | null;
  amount: string;
  currency: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  status: string;
  note: string | null;
  expense_date: string;
  created_by_user_id: number | null;
  created_by_name: string | null;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  rejection_note: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  deleted_by_name: string | null;
  delete_reason_ref: string | null;
};

export type CreateExpenseInput = {
  expense_type: string;
  agent_id?: number | null;
  amount: number;
  currency?: string;
  warehouse_id?: number | null;
  note?: string | null;
  expense_date?: Date;
};

export type ExpenseSummaryItem = {
  key: string;
  label: string;
  count: number;
  total: string;
};

export type ExpenseSummaryByType = ExpenseSummaryItem[];
export type ExpenseSummaryByAgent = ExpenseSummaryItem[];

export type PnlReport = {
  revenue: string;
  total_expenses_approved: string;
  total_expenses_draft: string;
  net_profit: string;
  period_from?: string;
  period_to?: string;
};
