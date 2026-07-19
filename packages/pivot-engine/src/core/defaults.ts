import type { PivotConfig } from "../types/pivot.types.js";

export const DEFAULT_PIVOT_OPTIONS: PivotConfig["options"] = {
  showSubtotals: true,
  showGrandTotal: true,
  showColumnTotals: false,
  compactMode: false,
  layoutForm: "classic",
  valuesPosition: "columns",
  drillDown: true,
  drillThrough: false,
  maxRows: 50_000
};

export const DEFAULT_PIVOT_CONFIG: PivotConfig = {
  rows: [],
  columns: [],
  values: [],
  reportFilters: [],
  filters: [],
  options: { ...DEFAULT_PIVOT_OPTIONS }
};
