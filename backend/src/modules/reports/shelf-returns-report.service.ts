/** Отчет по возвратам (возврат с полки) — SalesDoc `/report/defect`. */
export type { ShelfReturnsFilters, ShelfReturnsLineRow, ShelfReturnsDateType } from "./shelf-returns.types";
export { parseShelfReturnsQuery } from "./shelf-returns.parse";
export { getShelfReturnsFilterOptions } from "./shelf-returns.filters";
export { getShelfReturnsReport } from "./shelf-returns.report";
export { exportShelfReturnsXlsx } from "./shelf-returns.export";
