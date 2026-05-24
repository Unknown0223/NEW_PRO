import { buildFinanceQueryString } from "@/components/dashboard/finance/build-finance-query";
import {
  categoryTableColumns,
  clientLedgerCsvValue,
  territoryTableColumns
} from "@/components/dashboard/finance/table-columns";
import { fmtFinanceCount, fmtFinanceMoney, fmtFinancePercent } from "@/components/dashboard/finance/format";
import type { FinanceDashboardSnapshot, FinanceFilterDraft } from "@/components/dashboard/finance/types";

function fileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export function financeExportPrefix(applied: FinanceFilterDraft): string {
  return `finance-${applied.from}_${applied.to}`;
}

async function exportSheetsToXlsx(
  fileName: string,
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: "xlsx", compression: true });
}

export async function exportFinanceAll(data: FinanceDashboardSnapshot, prefix: string): Promise<void> {
  const catCols = categoryTableColumns();
  const terrCols = territoryTableColumns((t) => t);

  const sheets: Array<{ name: string; rows: Array<Array<string | number>> }> = [
    {
      name: "Summary",
      rows: [
        ["Показатель", "Значение"],
        ["Продажи", data.summary.total_sales_sum],
        ["Возвраты", data.summary.total_returns_sum],
        ["Оплаты", data.summary.total_payments_sum],
        ["Чистые продажи", data.summary.net_sales_sum],
        ["Задолженность", data.summary.outstanding_debt_sum],
        ["Доля долга %", data.summary.debt_ratio_pct]
      ]
    },
    {
      name: "Categories",
      rows: [
        catCols.map((c) => c.label),
        ...data.category_analytics.map((row) =>
          catCols.map((c) => (c.csvValue ? c.csvValue(row) : String(c.value(row))))
        )
      ]
    },
    {
      name: "Territories",
      rows: [
        terrCols.map((c) => c.label),
        ...data.territory_debts.map((row) =>
          terrCols.map((c) => (c.csvValue ? c.csvValue(row) : String(c.value(row))))
        )
      ]
    },
    {
      name: "Clients",
      rows: [
        ["Клиент", "Агент", "Супервайзер", "Баланс", "Долг доставки", "Эффективный"],
        ...data.clients_debt_list.map((row) => [
          row.client_name,
          row.agent_name ?? "",
          row.supervisor_name ?? "",
          row.ledger_balance,
          row.delivered_debt,
          row.effective_balance
        ])
      ]
    }
  ];

  await exportSheetsToXlsx(fileToken(prefix), sheets);
}

/** Build filter query string for export filename metadata. */
export function financeQueryLabel(applied: FinanceFilterDraft): string {
  return buildFinanceQueryString(applied);
}

export function buildCategoryTotalsRow(
  data: FinanceDashboardSnapshot
): Record<string, string> {
  const sum = data.category_analytics.reduce((s, r) => s + Number(r.sales_sum), 0);
  const orders = data.category_analytics.reduce((s, r) => s + r.order_count, 0);
  return {
    category: "Итого",
    sales_sum: fmtFinanceMoney(sum),
    share: "100%",
    order_count: fmtFinanceCount(orders)
  };
}

export function buildTerritoryTotalsRow(data: FinanceDashboardSnapshot): Record<string, string> {
  const sum = data.territory_debts.reduce((s, r) => s + Number(r.debt_sum), 0);
  const debtors = data.territory_debts.reduce((s, r) => s + r.debtors_count, 0);
  return {
    territory: "Итого",
    debt_sum: fmtFinanceMoney(sum),
    debtors: fmtFinanceCount(debtors)
  };
}
