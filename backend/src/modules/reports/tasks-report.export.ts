import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseTasksReportQuery } from "./tasks-report.parse";
import { getTasksReport } from "./tasks-report.report";

export async function exportTasksReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseTasksReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getTasksReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "ИД",
    "Задача",
    "Комментарий",
    "Статус",
    "Приоритет",
    "Тип задачи",
    "Исполняющий",
    "Назначающий",
    "Клиент",
    "Дата создания",
    "Срок",
    "Завершена",
    "Результат",
    "Фото"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.task_id,
    r.title,
    r.description,
    r.status_label,
    r.priority_label,
    r.task_type,
    r.assignee_name,
    r.created_by_name,
    r.client_name,
    new Date(r.created_at).toLocaleString("ru-RU"),
    r.due_at ? new Date(r.due_at).toLocaleString("ru-RU") : "",
    r.completed_at ? new Date(r.completed_at).toLocaleString("ru-RU") : "",
    r.result_comment,
    r.photo_count
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "По задачам");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
