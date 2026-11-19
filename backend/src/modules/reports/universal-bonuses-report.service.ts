/**
 * Универсальный отчет по бонусам — SalesDoc `/report/bonus` (flat).
 * Pivot grain → same engine as bonuses-report.
 */
export type {
  BonusesReportFilters as UniversalBonusesReportFilters,
  BonusesReportRow as UniversalBonusesReportRow
} from "./bonuses-report.types";
export { parseBonusesReportQuery as parseUniversalBonusesReportQuery } from "./bonuses-report.parse";
export { getBonusesReportFilterOptions as getUniversalBonusesReportFilterOptions } from "./bonuses-report.filters";
export { getBonusesReport as getUniversalBonusesReport } from "./bonuses-report.report";
export { exportBonusesReportXlsx as exportUniversalBonusesReportXlsx } from "./bonuses-report.export";
