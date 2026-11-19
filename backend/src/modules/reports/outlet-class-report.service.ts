/** Классификация торговых точек — SalesDoc `/report/client/classification`. */
export type { OutletClassReportFilters, OutletClassReportRow } from "./outlet-class-report.types";
export { parseOutletClassReportQuery, parseOutletClassBands } from "./outlet-class-report.parse";
export { getOutletClassReportFilterOptions } from "./outlet-class-report.filters";
export { getOutletClassReport } from "./outlet-class-report.report";
export { exportOutletClassReportXlsx } from "./outlet-class-report.export";
