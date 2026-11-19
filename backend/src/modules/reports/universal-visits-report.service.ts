/**
 * Универсальный отчет по посещениям — SalesDoc `/report/visit` (flat).
 * Pivot grain → same engine as visits-report.
 */
export type {
  VisitsReportFilters as UniversalVisitsReportFilters,
  VisitsReportRow as UniversalVisitsReportRow
} from "./visits-report.types";
export { parseVisitsReportQuery as parseUniversalVisitsReportQuery } from "./visits-report.parse";
export { getVisitsReportFilterOptions as getUniversalVisitsReportFilterOptions } from "./visits-report.filters";
export { getVisitsReport as getUniversalVisitsReport } from "./visits-report.report";
export { exportVisitsReportXlsx as exportUniversalVisitsReportXlsx } from "./visits-report.export";
