/**
 * Универсальный отчёт по продажам — SalesDoc flat pivot (same engine as product-sales).
 */
export type {
  ProductSalesReportFilters as UniversalSalesReportFilters
} from "./product-sales.types";
export { parseProductSalesReportQuery as parseUniversalSalesReportQuery } from "./product-sales.parse";
export { getProductSalesReportFilterOptions as getUniversalSalesReportFilterOptions } from "./product-sales.filters";
export { getProductSalesReport as getUniversalSalesReport } from "./product-sales.report";
export { exportProductSalesReportXlsx as exportUniversalSalesReportXlsx } from "./product-sales.export";