export type FinanceProTransactionType = "Доход" | "Расход" | "Перевод";
export type FinanceProPaymentStatus = "Ожидает" | "Оплачено";

export type FinanceProDetailView =
  | { kind: "transactions" }
  | { kind: "income" }
  | { kind: "expense" }
  | { kind: "breakdown" }
  | { kind: "accounts" }
  | { kind: "account"; accountName: string }
  | { kind: "payments" }
  | { kind: "chart" };

export type FinanceProChartPoint = {
  label: string;
  income: number;
  expense: number;
  profit: number;
};

export type FinanceProCategoryItem = {
  name: string;
  amount: number;
  pct: number;
  color: string;
};

export type FinanceProTransaction = {
  id: number;
  date: string;
  type: FinanceProTransactionType;
  description: string;
  amount: number;
  status: string;
  account: string;
  category: string;
};

export type FinanceProScheduledPayment = {
  id: number;
  date: string;
  name: string;
  category: string;
  account: string;
  amount: number;
  status: FinanceProPaymentStatus;
};

export type FinanceProAccount = {
  id: number;
  name: string;
  amount: number;
  type: string;
  color: string;
};

export type FinanceProUiModel = {
  totalIncome: number;
  totalExpense: number;
  totalProfit: number;
  accountsBalance: number;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  profitChangePct: number | null;
  balanceChangePct: number | null;
  incomeSpark: number[];
  expenseSpark: number[];
  profitSpark: number[];
  balanceSpark: number[];
  cashflowByPeriod: FinanceProChartPoint[];
  incomeCategories: FinanceProCategoryItem[];
  expenseCategories: FinanceProCategoryItem[];
  recentTransactions: FinanceProTransaction[];
  accounts: FinanceProAccount[];
  scheduledPayments: FinanceProScheduledPayment[];
};

export type FinanceProPeriodKey = "Сегодня" | "Вчера" | "Неделя" | "Месяц" | "Квартал" | "Год";