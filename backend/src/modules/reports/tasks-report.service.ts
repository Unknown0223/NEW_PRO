/** Отчёт по задачам — SalesDoc `/report/tasksReport`. */
export type { TasksReportFilters, TasksReportRow } from "./tasks-report.types";
export { parseTasksReportQuery } from "./tasks-report.parse";
export { getTasksReportFilterOptions } from "./tasks-report.filters";
export { getTasksReport } from "./tasks-report.report";
export { exportTasksReportXlsx } from "./tasks-report.export";
