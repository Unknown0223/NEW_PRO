export const DEFAULT_PIVOT_OPTIONS = {
    showSubtotals: true,
    showGrandTotal: true,
    showColumnTotals: false,
    compactMode: false,
    layoutForm: "classic",
    valuesPosition: "columns",
    drillDown: true,
    drillThrough: false,
    maxRows: 50000
};
export const DEFAULT_PIVOT_CONFIG = {
    rows: [],
    columns: [],
    values: [],
    reportFilters: [],
    filters: [],
    options: { ...DEFAULT_PIVOT_OPTIONS }
};
