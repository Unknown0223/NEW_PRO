/** Накопительный бонус — SalesDoc `/report/bonusAccumulation`. */
export type { CumulativeBonusFilters, CumulativeBonusRow } from "./cumulative-bonus.types";
export { parseCumulativeBonusQuery } from "./cumulative-bonus.parse";
export { getCumulativeBonusFilterOptions } from "./cumulative-bonus.filters";
export { getCumulativeBonusReport } from "./cumulative-bonus.report";
export { exportCumulativeBonusXlsx } from "./cumulative-bonus.export";
