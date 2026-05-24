"use client";

import type { ReactNode } from "react";
import type {
  FinanceCategoryRow,
  FinanceClientDebtRow,
  FinanceTerritoryDebtRow
} from "@/components/dashboard/finance/types";
import { fmtFinanceCount, fmtFinanceMoney, fmtFinancePercent } from "@/components/dashboard/finance/format";

export type FinanceTableColumn<T> = {
  id: string;
  label: string;
  className?: string;
  value: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string;
  csvValue?: (row: T) => string | number;
};

export function categoryTableColumns(): FinanceTableColumn<FinanceCategoryRow>[] {
  return [
    {
      id: "category",
      label: "Категория",
      className: "text-left",
      value: (row) => row.category,
      sortValue: (row) => row.category,
      csvValue: (row) => row.category
    },
    {
      id: "sales_sum",
      label: "Общая сумма",
      value: (row) => fmtFinanceMoney(row.sales_sum),
      sortValue: (row) => Number(row.sales_sum),
      csvValue: (row) => row.sales_sum
    },
    {
      id: "share",
      label: "Доля",
      value: (row) => fmtFinancePercent(row.sales_share_pct),
      sortValue: (row) => row.sales_share_pct,
      csvValue: (row) => row.sales_share_pct
    },
    {
      id: "order_count",
      label: "Заказы",
      value: (row) => fmtFinanceCount(row.order_count),
      sortValue: (row) => row.order_count,
      csvValue: (row) => row.order_count
    }
  ];
}

export function territoryTableColumns(
  resolveTerritoryDisplay: (raw: string) => string
): FinanceTableColumn<FinanceTerritoryDebtRow>[] {
  return [
    {
      id: "territory",
      label: "Территория",
      className: "text-left",
      value: (row) => resolveTerritoryDisplay(row.territory),
      sortValue: (row) => resolveTerritoryDisplay(row.territory),
      csvValue: (row) => resolveTerritoryDisplay(row.territory)
    },
    {
      id: "debt_sum",
      label: "Общая сумма",
      value: (row) => fmtFinanceMoney(row.debt_sum),
      sortValue: (row) => Number(row.debt_sum),
      csvValue: (row) => row.debt_sum
    },
    {
      id: "debtors",
      label: "Должники",
      value: (row) => fmtFinanceCount(row.debtors_count),
      sortValue: (row) => row.debtors_count,
      csvValue: (row) => row.debtors_count
    }
  ];
}

export const CLIENT_LEDGER_COL_DEFS: Array<{ id: string; label: string }> = [
  { id: "client", label: "Клиент" },
  { id: "agent", label: "Агент" },
  { id: "supervisor", label: "Супервайзер" },
  { id: "ledger_balance", label: "Баланс" },
  { id: "delivered_debt", label: "Долг (доставлено)" },
  { id: "effective_balance", label: "Эффективный баланс" }
];

export function clientLedgerCell(
  row: FinanceClientDebtRow,
  colId: string
): ReactNode {
  switch (colId) {
    case "client":
      return <span className="block max-w-[320px] truncate text-left font-medium">{row.client_name}</span>;
    case "agent":
      return row.agent_name ?? "—";
    case "supervisor":
      return row.supervisor_name ?? "—";
    case "ledger_balance":
      return fmtFinanceMoney(row.ledger_balance);
    case "delivered_debt":
      return fmtFinanceMoney(row.delivered_debt);
    case "effective_balance":
      return fmtFinanceMoney(row.effective_balance);
    default:
      return "—";
  }
}

export function clientLedgerSortValue(row: FinanceClientDebtRow, colId: string): number | string {
  switch (colId) {
    case "client":
      return row.client_name;
    case "agent":
      return row.agent_name ?? "";
    case "supervisor":
      return row.supervisor_name ?? "";
    case "ledger_balance":
      return Number(row.ledger_balance);
    case "delivered_debt":
      return Number(row.delivered_debt);
    case "effective_balance":
      return Number(row.effective_balance);
    default:
      return "";
  }
}

export function clientLedgerCsvValue(row: FinanceClientDebtRow, colId: string): string | number {
  switch (colId) {
    case "client":
      return row.client_name;
    case "agent":
      return row.agent_name ?? "";
    case "supervisor":
      return row.supervisor_name ?? "";
    case "ledger_balance":
      return row.ledger_balance;
    case "delivered_debt":
      return row.delivered_debt;
    case "effective_balance":
      return row.effective_balance;
    default:
      return "";
  }
}
