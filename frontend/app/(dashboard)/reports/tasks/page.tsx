"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtDt(iso: unknown) {
  if (iso == null || iso === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

const config: FlatReportConfig = {
  title: "Отчёт по задачам",
  apiPath: "tasks",
  exportPermission: "reports.otchet_po_zadacham.export",
  exportFilename: "otchet-po-zadacham.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Задача / клиент / сотрудник" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    {
      kind: "multiSelect",
      paramKey: "priorities",
      optionsFrom: "priorities",
      placeholder: "Приоритет"
    },
    {
      kind: "multiSelect",
      paramKey: "task_type_refs",
      optionsFrom: "task_types",
      placeholder: "Тип задачи"
    },
    {
      kind: "multiSelect",
      paramKey: "assignee_ids",
      optionsFrom: "assignees",
      placeholder: "Исполняющий"
    },
    {
      kind: "multiSelect",
      paramKey: "created_by_ids",
      optionsFrom: "creators",
      placeholder: "Назначающий"
    },
    { kind: "multiSelect", paramKey: "client_ids", optionsFrom: "clients", placeholder: "Клиент" }
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "title", header: "Задача", cellClassName: "font-medium" },
    { key: "description", header: "Комментарий" },
    { key: "status_label", header: "Статус" },
    { key: "priority_label", header: "Приоритет" },
    { key: "task_type", header: "Тип" },
    { key: "assignee_name", header: "Исполняющий" },
    { key: "created_by_name", header: "Назначающий" },
    { key: "client_name", header: "Клиент" },
    { key: "created_at", header: "Создана" },
    { key: "due_at", header: "Срок" },
    { key: "result_comment", header: "Результат" },
    { key: "photo_count", header: "Фото", align: "right", format: "number" }
  ],
  totalsKeys: [],
  rowKey: "task_id",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: [
      "title",
      "description",
      "result_comment",
      "assignee_name",
      "created_by_name",
      "client_name",
      "task_type"
    ],
    placeholder: "Фильтр в таблице…"
  },
  formatters: {
    created_at: (v) => fmtDt(v),
    due_at: (v) => fmtDt(v),
    description: (v) => String(v ?? "") || "—",
    result_comment: (v) => String(v ?? "") || "—"
  }
};

export default function ReportTasksPage() {
  return <FlatReportPage {...config} />;
}
