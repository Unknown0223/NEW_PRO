import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseBalanceControlReportQuery } from "./balance-control-report.parse";
import { getBalanceControlReport } from "./balance-control-report.report";

export async function exportBalanceControlReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseBalanceControlReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getBalanceControlReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Клиент",
    "Агент",
    "Категория",
    "Территория",
    "Баланс",
    "Продажи за период",
    "Оплаты за период",
    "Тип баланса"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.client_name,
    r.agent_name,
    r.client_category,
    r.territory,
    r.balance,
    r.period_sales,
    r.period_payments,
    r.debt_flag_label
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "Балансы");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}