import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseRfmReportQuery } from "./rfm-report.parse";
import { getRfmReport } from "./rfm-report.report";

export async function exportRfmReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseRfmReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getRfmReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Клиент",
    "Агент",
    "Категория",
    "Посл. заказ",
    "Дней с посл.",
    "Заказов",
    "Сумма",
    "Ср. чек",
    "R",
    "F",
    "M",
    "RFM"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.client_name,
    r.agent_name,
    r.client_category,
    r.last_order_at,
    r.last_order_days,
    r.order_count,
    r.sales_sum,
    r.avg_check,
    r.r_score,
    r.f_score,
    r.m_score,
    r.rfm_label
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "RFM");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}