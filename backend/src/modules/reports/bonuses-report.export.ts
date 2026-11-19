import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseBonusesReportQuery } from "./bonuses-report.parse";
import { getBonusesReport } from "./bonuses-report.report";

export async function exportBonusesReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseBonusesReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getBonusesReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = ["#", "Название", "SKU", "Категория", "Агент", "Клиент", "Кол-во", "Объём", "АКБ", "Заказов"];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.name,
    r.sku,
    r.category_name,
    r.agent_name,
    r.client_name,
    r.qty,
    r.volume_m3,
    r.akb,
    r.order_count
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "По бонусам");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
