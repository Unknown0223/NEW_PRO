/** SalesDoc `/report/analyze` — Сравнительный анализ продаж. */
export type { SalesCompareReportFilters, SalesCompareReportRow } from "./sales-compare-report.types";
export { parseSalesCompareReportQuery, previousMonthYmd } from "./sales-compare-report.parse";
export { getSalesCompareReportFilterOptions } from "./sales-compare-report.filters";
export { getSalesCompareReport } from "./sales-compare-report.report";
export { exportSalesCompareReportXlsx } from "./sales-compare-report.export";