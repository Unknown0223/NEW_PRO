import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseOrderQtyQuery } from "./order-qty.parse";
import { getOrderQtyReport } from "./order-qty.report";

export async function exportOrderQtyXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseOrderQtyQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getOrderQtyReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = ["Т.Т.", "Телефон клиента", "Т.П.", "Заказ", "Возврат с полки", "Обмен"];
  const rows = report.rows.map((r) => [
    r.client_name,
    r.phone,
    r.agent_name,
    r.order_count,
    r.return_count,
    r.exchange_count
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Кол-во заказов");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
