import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parsePhotoReportQuery } from "./photo-report.parse";
import { getPhotoReport } from "./photo-report.report";

export async function exportPhotoReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parsePhotoReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getPhotoReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "ИД клиента",
    "Код клиента",
    "Клиент",
    "Дата",
    "Категория клиента",
    "Территория",
    "Пользователь",
    "Роль",
    "Категория отчета",
    "Статус"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.client_id,
    r.client_code,
    r.client_name,
    new Date(r.created_at).toLocaleString("ru-RU"),
    r.client_category,
    r.territory,
    r.user_name,
    r.user_role,
    r.category,
    r.status_label
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "Фотоотчёты");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
