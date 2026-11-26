/**
 * Универсальный отчет по бонусам — SalesDoc `/report/bonus`.
 * FlatReport agregat saqlanadi; Virtual Pivot → line dataset.
 */
export type {
  BonusesReportFilters as UniversalBonusesReportFilters,
  BonusesReportRow as UniversalBonusesReportRow
} from "./bonuses-report.types";
export { parseBonusesReportQuery as parseUniversalBonusesReportQuery } from "./bonuses-report.parse";
export { getBonusesReportFilterOptions as getUniversalBonusesReportFilterOptions } from "./bonuses-report.filters";
export { getBonusesReport as getUniversalBonusesReport } from "./bonuses-report.report";
export { exportBonusesReportXlsx as exportUniversalBonusesReportXlsx } from "./bonuses-report.export";
export {
  getUniversalBonusesReportDataset,
  UNIVERSAL_BONUSES_PIVOT_FIELDS,
  UNIVERSAL_BONUSES_DATASET_CAP
} from "./universal-bonuses-report.dataset";
