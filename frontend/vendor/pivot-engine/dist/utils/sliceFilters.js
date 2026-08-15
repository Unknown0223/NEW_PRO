/**
 * Filters that affect pivot computation: report filters, row/column dimensions,
 * and value (measure) fields — matching WebDataRocks header-filter semantics.
 */
export function getActiveSliceFilters(config) {
    return config.filters.filter((f) => config.reportFilters.includes(f.fieldId) ||
        config.rows.includes(f.fieldId) ||
        config.columns.includes(f.fieldId) ||
        config.values.some((v) => v.fieldId === f.fieldId));
}
