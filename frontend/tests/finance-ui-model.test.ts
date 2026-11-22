import { describe, expect, it } from "vitest";
import { buildFinanceProUiModel } from "@/components/dashboard/finance/finance-ui-model";
import type { FinanceSummaryPayload } from "@/components/dashboard/finance/types";

function baseSummary(overrides: Partial<FinanceSummaryPayload> = {}): FinanceSummaryPayload {
  return {
    filters: {
      date_type: "order",
      from: "2026-10-01",
      to: "2026-10-31",
      payment_types: [],
      agent_ids: [],
      supervisor_ids: [],
      trade_directions: [],
      client_categories: [],
      category_ids: [],
      territory_1_list: [],
      territory_2_list: [],
      territory_3_list: [],
      statuses: []
    },
    summary: {
      total_sales_sum: "1000",
      total_payments_sum: "800",
      total_returns_sum: "50",
      net_sales_sum: "950",
      outstanding_debt_sum: "100",
      debt_ratio_pct: 10
    },
    category_analytics: [],
    payment_type_analytics: [],
    general_balance: {
      total_balance: "500",
      debt_clients_count: 1,
      credit_clients_count: 0
    },
    debt_and_payment_by_period: [],
    period_balance: {
      uzs: "500",
      cash: "200",
      transfer: "0",
      terminal: "0",
      tenge: "0"
    },
    period_granularity: "day",
    ...overrides
  };
}

describe("buildFinanceProUiModel", () => {
  it("pro blok bo‘lsa — undan income/expense/transactions oladi", () => {
    const model = buildFinanceProUiModel(
      baseSummary({
        pro: {
          total_income: "1200.50",
          total_expense: "300",
          total_profit: "900.50",
          accounts_balance: "4500",
          income_change_pct: 12.5,
          expense_change_pct: -3,
          profit_change_pct: 18,
          balance_change_pct: null,
          income_spark: [1, 2, 3],
          expense_spark: [1, 1, 2],
          profit_spark: [1, 2, 2],
          balance_spark: [1, 2, 3],
          cashflow_by_period: [
            { period: "2026-10-01", income: "100", expense: "40", profit: "60" }
          ],
          income_categories: [{ name: "Наличные", amount: "100", pct: 100, color: "#29c8a4" }],
          expense_categories: [{ name: "Аренда", amount: "40", pct: 100, color: "#287cf4" }],
          recent_transactions: [
            {
              id: 9,
              date: "01.10.2026 12:00",
              type: "income",
              description: "Оплата",
              amount: "100",
              status: "Завершено",
              account: "Основной",
              category: "Наличные"
            }
          ],
          accounts: [{ id: 1, name: "Основной", amount: "4500", type: "Касса", color: "#287cf4" }],
          scheduled_payments: []
        }
      })
    );

    expect(model.totalIncome).toBe(1200.5);
    expect(model.totalExpense).toBe(300);
    expect(model.totalProfit).toBe(900.5);
    expect(model.accountsBalance).toBe(4500);
    expect(model.incomeChangePct).toBe(12.5);
    expect(model.recentTransactions).toHaveLength(1);
    expect(model.recentTransactions[0]?.type).toBe("Доход");
    expect(model.cashflowByPeriod[0]).toEqual({
      label: "2026-10-01",
      income: 100,
      expense: 40,
      profit: 60
    });
  });

  it("pro yo‘q bo‘lsa — legacy summary maydonlariga map qiladi", () => {
    const model = buildFinanceProUiModel(baseSummary());
    expect(model.totalIncome).toBe(800);
    expect(model.totalExpense).toBe(50);
    expect(model.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Наличные", amount: 200 }),
        expect.objectContaining({ name: "UZS", amount: 500 })
      ])
    );
    expect(model.recentTransactions).toEqual([]);
  });
});
