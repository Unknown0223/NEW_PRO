import type { FlatReportConfig, FlatReportFilterField } from "@/components/reports/flat-report/types";

export const TASKS_FILTER_FIELDS: FlatReportFilterField[] = [
  { kind: "dateRange" },
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
];

/** Shell for FlatReportFilters (grid only). */
export const TASKS_FILTER_CONFIG = {
  title: "Отчёт по задачам",
  apiPath: "tasks",
  exportPermission: "reports.otchet_po_zadacham.export",
  exportFilename: "otchet-po-zadacham.xlsx",
  filterGridCols: 6,
  filterFields: TASKS_FILTER_FIELDS,
  columns: [],
  totalsKeys: [],
  rowKey: "task_id"
} as FlatReportConfig;
