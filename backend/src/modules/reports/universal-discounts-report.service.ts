/** Универсальный отчет по скидкам — line list (shared engine with discount-detail). */
export type {
  DiscountDetailReportFilters as UniversalDiscountsReportFilters,
  DiscountDetailReportRow as UniversalDiscountsReportRow
} from "./discount-detail-report.types";
export { parseDiscountDetailReportQuery as parseUniversalDiscountsReportQuery } from "./discount-detail-report.parse";
export { getDiscountDetailReportFilterOptions as getUniversalDiscountsReportFilterOptions } from "./discount-detail-report.filters";
export { getDiscountDetailReport as getUniversalDiscountsReport } from "./discount-detail-report.report";
export { exportDiscountDetailReportXlsx as exportUniversalDiscountsReportXlsx } from "./discount-detail-report.export";