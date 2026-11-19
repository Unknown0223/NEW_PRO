import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { ORDER_STATUS_LABEL_RU } from "./expeditor-returns.helpers";
import { parseDiscountDetailReportQuery } from "./discount-detail-report.parse";
import { getDiscountDetailReport } from "./discount-detail-report.report";

export async function exportDiscountDetailReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseDiscountDetailReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getDiscountDetailReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = ["Дата", "№ заказа", "Клиент", "Агент", "Скидка", "Сумма", "Статус"];
  const rows = report.rows.map((r) => [
    r.order_date,
    r.order_number,
    r.client_name,
    r.agent_name,
    r.discount_sum,
    r.total_sum,
    ORDER_STATUS_LABEL_RU[r.status] ?? r.status
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "Скидки");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}