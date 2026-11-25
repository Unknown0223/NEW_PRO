import type { ReportActor } from "./client-sales-4-report.service";
import { getTasksReport } from "./tasks-report.report";
import type { TasksReportFilters, TasksReportRow } from "./tasks-report.types";

const DATASET_CAP = 5000;

export type TasksPivotFieldMeta = {
  id: string;
  label: string;
  dataType: "string" | "number" | "date";
};

/** SalesDoc tasksReport flat virtual columns (1-wave). */
export const TASKS_PIVOT_FIELDS: TasksPivotFieldMeta[] = [
  { id: "task_id", label: "ID задачиДАЧИ", dataType: "number" },
  { id: "title", label: "ЗАДАЧА", dataType: "string" },
  { id: "client_name", label: "КЛИЕНТ", dataType: "string" },
  { id: "created_by_name", label: "НАЗНАЧАЮЩИЙ", dataType: "string" },
  { id: "assignee_name", label: "ИСПОЛНИТЕЛЬ", dataType: "string" },
  { id: "status_label", label: "СТАТУС", dataType: "string" },
  { id: "description", label: "КОММЕНТАРИЙ", dataType: "string" },
  { id: "result_comment", label: "ПРИМЕЧАНИЕ", dataType: "string" },
  { id: "photo_count", label: "ФОТО", dataType: "number" },
  { id: "task_type", label: "ТИП ЗАДАЧИ", dataType: "string" },
  { id: "priority_label", label: "ПРИОРИТЕТ", dataType: "string" },
  { id: "created_at", label: "ДАТА СОЗДАНИЯ", dataType: "date" },
  { id: "due_at", label: "СРОК", dataType: "date" },
  { id: "completed_at", label: "ЗАВЕРШЕНА", dataType: "date" }
];

function rowToRecord(r: TasksReportRow): Record<string, unknown> {
  return {
    task_id: r.task_id,
    title: r.title,
    client_name: r.client_name,
    created_by_name: r.created_by_name,
    assignee_name: r.assignee_name,
    status_label: r.status_label,
    description: r.description,
    result_comment: r.result_comment,
    photo_count: r.photo_count,
    task_type: r.task_type,
    priority_label: r.priority_label,
    created_at: r.created_at,
    due_at: r.due_at,
    completed_at: r.completed_at
  };
}

export async function getTasksReportDataset(
  tenantId: number,
  f: TasksReportFilters,
  actor?: ReportActor
) {
  const capped: TasksReportFilters = {
    ...f,
    page: 1,
    limit: DATASET_CAP
  };
  const report = await getTasksReport(tenantId, capped, actor);
  const truncated = report.total > report.rows.length;
  return {
    fields: TASKS_PIVOT_FIELDS,
    rows: report.rows.map(rowToRecord),
    total: report.total,
    truncated,
    period_from: report.period_from,
    period_to: report.period_to
  };
}
