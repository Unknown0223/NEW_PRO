/**
 * Универсальный отчет по возвратам — SalesDoc `/report/expeditorDefect` (flat).
 * Pivot grain → return order lines; engine shared with shelf-returns.
 */
export type {
  ShelfReturnsFilters as UniversalReturnsReportFilters,
  ShelfReturnsLineRow as UniversalReturnsReportRow,
  ShelfReturnsDateType as UniversalReturnsDateType
} from "./shelf-returns.types";
export { parseShelfReturnsQuery as parseUniversalReturnsReportQuery } from "./shelf-returns.parse";
export { getShelfReturnsFilterOptions as getUniversalReturnsReportFilterOptions } from "./shelf-returns.filters";
export { getShelfReturnsReport as getUniversalReturnsReport } from "./shelf-returns.report";
export { exportShelfReturnsXlsx as exportUniversalReturnsReportXlsx } from "./shelf-returns.export";
