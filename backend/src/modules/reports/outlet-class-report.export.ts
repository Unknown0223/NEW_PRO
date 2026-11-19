import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseOutletClassReportQuery } from "./outlet-class-report.parse";
import { getOutletClassReport } from "./outlet-class-report.report";

export async function exportOutletClassReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseOutletClassReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getOutletClassReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Класс",
    "Клиент",
    "Агент",
    "Категория",
    "Заказов",
    "Продуктов",
    "Сумма",
    "Средний чек"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.class_name,
    r.client_name,
    r.agent_name,
    r.client_category,
    r.order_count,
    r.product_count,
    r.sales_sum,
    r.avg_check
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Классификация ТТ");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
