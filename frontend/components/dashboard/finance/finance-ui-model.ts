import type { FinanceSummaryPayload } from "@/components/dashboard/finance/types";
import {
  formatIsoToDot,
  parseFinanceProAmount
} from "@/components/dashboard/finance/pro/finance-pro-format";
import type {
  FinanceProCategoryItem,
  FinanceProScheduledPayment,
  FinanceProTransaction,
  FinanceProTransactionType,
  FinanceProUiModel
} from "@/components/dashboard/finance/pro/finance-pro-types";

const EXPENSE_COLORS = ["#287cf4", "#4c91f7", "#8448eb", "#ae5ce8", "#38c7ad", "#f7b62d", "#ff768f"];
const INCOME_COLORS = ["#29c8a4", "#287cf4", "#9c54ec", "#ff768f", "#f7b62d"];
const ACCOUNT_COLORS = ["#287cf4", "#16bb91", "#356ee8", "#efaa16", "#9147ed", "#29c8a4"];

function mapTransactionType(type: string): FinanceProTransactionType {
  if (type === "income") return "Доход";
  if (type === "expense") return "Расход";
  return "Перевод";
}

function mapPaymentStatus(status: string): FinanceProScheduledPayment["status"] {
  return status === "paid" ? "Оплачено" : "Ожидает";
}

function withPalette(items: { name: string; amount: number; pct: number }[], colors: string[]): FinanceProCategoryItem[] {
  return items.map((item, index) => ({
    ...item,
    color: colors[index % colors.length]!
  }));
}

function defaultSpark(): number[] {
  return [5, 6, 7, 9, 8, 10, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16];
}

function buildFromPro(pro: NonNullable<FinanceSummaryPayload["pro"]>): FinanceProUiModel {
  const cashflowByPeriod = pro.cashflow_by_period.map((row) => {
    const income = parseFinanceProAmount(row.income);
    const expense = parseFinanceProAmount(row.expense);
    const profit = parseFinanceProAmount(row.profit) || income - expense;
    return { label: row.period, income, expense, profit };
  });

  const recentTransactions: FinanceProTransaction[] = pro.recent_transactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    type: mapTransactionType(tx.type),
    description: tx.description,
    amount: parseFinanceProAmount(tx.amount),
    status: tx.status,
    account: tx.account,
    category: tx.category
  }));

  return {
    totalIncome: parseFinanceProAmount(pro.total_income),
    totalExpense: parseFinanceProAmount(pro.total_expense),
    totalProfit: parseFinanceProAmount(pro.total_profit),
    accountsBalance: parseFinanceProAmount(pro.accounts_balance),
    incomeChangePct: pro.income_change_pct,
    expenseChangePct: pro.expense_change_pct,
    profitChangePct: pro.profit_change_pct,
    balanceChangePct: pro.balance_change_pct,
    incomeSpark: pro.income_spark,
    expenseSpark: pro.expense_spark,
    profitSpark: pro.profit_spark,
    balanceSpark: pro.balance_spark,
    cashflowByPeriod,
    incomeCategories: pro.income_categories.map((c) => ({
      name: c.name,
      amount: parseFinanceProAmount(c.amount),
      pct: c.pct,
      color: c.color
    })),
    expenseCategories: pro.expense_categories.map((c) => ({
      name: c.name,
      amount: parseFinanceProAmount(c.amount),
      pct: c.pct,
      color: c.color
    })),
    recentTransactions,
    accounts: pro.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      amount: parseFinanceProAmount(a.amount),
      type: a.type,
      color: a.color
    })),
    scheduledPayments: pro.scheduled_payments.map((p) => ({
      id: p.id,
      date: p.date,
      name: p.name,
      category: p.category,
      account: p.account,
      amount: parseFinanceProAmount(p.amount),
      status: mapPaymentStatus(p.status)
    }))
  };
}

function buildLegacy(summary: FinanceSummaryPayload): FinanceProUiModel {
  const totalIncome = parseFinanceProAmount(summary.summary.total_payments_sum);
  const totalExpense = parseFinanceProAmount(summary.summary.total_returns_sum);
  const totalProfit = parseFinanceProAmount(summary.summary.net_sales_sum);
  const accountsBalance = parseFinanceProAmount(summary.general_balance.total_balance);

  const cashflowByPeriod = (summary.debt_and_payment_by_period ?? []).map((row) => {
    const income = parseFinanceProAmount(row.payment_sum);
    const expense = parseFinanceProAmount(row.debt_sum);
    return {
      label: row.period,
      income,
      expense,
      profit: income - expense
    };
  });

  const incomeRaw = (summary.payment_type_analytics ?? []).map((row) => ({
    name: row.payment_type,
    amount: parseFinanceProAmount(row.amount),
    pct: row.share_pct
  }));
  const expenseRaw = (summary.category_analytics ?? []).map((row) => ({
    name: row.category,
    amount: parseFinanceProAmount(row.sales_sum),
    pct: row.sales_share_pct
  }));

  const balance = summary.period_balance;
  const accounts = balance
    ? [
        { key: "uzs", name: "UZS", type: "Счёт" },
        { key: "cash", name: "Наличные", type: "Касса" },
        { key: "transfer", name: "Перевод", type: "Банк" },
        { key: "terminal", name: "Терминал", type: "Терминал" },
        { key: "tenge", name: "Tenge", type: "Валюта" }
      ]
        .map((meta, index) => {
          const amount = parseFinanceProAmount(balance[meta.key as keyof typeof balance]);
          if (!amount) return null;
          return {
            id: index + 1,
            name: meta.name,
            amount,
            type: meta.type,
            color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]!
          };
        })
        .filter(Boolean)
    : [];

  return {
    totalIncome,
    totalExpense,
    totalProfit: totalProfit || totalIncome - totalExpense,
    accountsBalance,
    incomeChangePct: null,
    expenseChangePct: null,
    profitChangePct: null,
    balanceChangePct: null,
    incomeSpark: defaultSpark(),
    expenseSpark: defaultSpark(),
    profitSpark: defaultSpark(),
    balanceSpark: defaultSpark(),
    cashflowByPeriod,
    incomeCategories: withPalette(incomeRaw, INCOME_COLORS),
    expenseCategories: withPalette(expenseRaw, EXPENSE_COLORS),
    recentTransactions: [],
    accounts: accounts as FinanceProUiModel["accounts"],
    scheduledPayments: []
  };
}

export function buildFinanceProUiModel(summary: FinanceSummaryPayload): FinanceProUiModel {
  if (summary.pro) return buildFromPro(summary.pro);
  return buildLegacy(summary);
}

export function formatFinanceProActiveDates(from: string, to: string): string {
  if (!from || !to) return "—";
  if (from === to) return formatIsoToDot(from);
  return `${formatIsoToDot(from)} — ${formatIsoToDot(to)}`;
}