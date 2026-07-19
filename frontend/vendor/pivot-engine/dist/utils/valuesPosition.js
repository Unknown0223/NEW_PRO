/** Virtual WDR «Measures» / «Σ Values» axis id (not a data field). */
export const PIVOT_VALUES_AXIS_ID = "__values__";
const WDR_MEASURES_NAMES = new Set(["measures", "__values__", "значения", "values"]);
/** true if uniqueName is the WDR virtual Measures hierarchy. */
export function isWdrMeasuresFieldId(fieldId) {
    const key = fieldId.trim().toLowerCase();
    return WDR_MEASURES_NAMES.has(key);
}
/** Default: columns (classic pivot — measures side by side). */
export function resolveValuesPosition(options) {
    return options?.valuesPosition === "rows" ? "rows" : "columns";
}
export function valuesOnRows(options) {
    return resolveValuesPosition(options) === "rows";
}
