import { FilterEngine } from "../core/FilterEngine.js";
import { ROOT_COL_KEY } from "../core/CubeBuilder.js";
import { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR, splitGroupKey } from "./groupBy.js";
const filterEngine = new FilterEngine();
/** Pivot kataki uchun manba qatorlarni qaytaradi. */
export function getDrillThroughRecords(rawData, fields, config, cellContext) {
    const reportScopedFilters = config.filters.filter((f) => config.reportFilters.includes(f.fieldId) ||
        config.rows.includes(f.fieldId) ||
        config.columns.includes(f.fieldId));
    let data = filterEngine.apply(rawData, reportScopedFilters, fields);
    if (config.options.maxRows) {
        data = data.slice(0, config.options.maxRows);
    }
    data = filterByRowGroupKey(data, config, cellContext.rowGroupKey);
    data = filterByColumnKey(data, config, cellContext.columnKey, cellContext.valueFieldId);
    return data;
}
function filterByRowGroupKey(data, config, rowGroupKey) {
    if (!config.rows.length || rowGroupKey === ALL_GROUP_KEY || rowGroupKey === "__all__") {
        return data;
    }
    const parts = splitGroupKey(rowGroupKey);
    const depth = Math.min(parts.length, config.rows.length);
    return data.filter((row) => config.rows.slice(0, depth).every((fieldId, i) => String(row[fieldId] ?? "N/A") === parts[i]));
}
function filterByColumnKey(data, config, columnKey, valueFieldId) {
    if (!config.columns.length)
        return data;
    const colCubeKey = columnKey.includes("__")
        ? columnKey.split("__")[0]
        : columnKey === valueFieldId
            ? ROOT_COL_KEY
            : columnKey;
    if (colCubeKey === ROOT_COL_KEY)
        return data;
    const colParts = splitGroupKey(colCubeKey);
    return data.filter((row) => config.columns.every((fieldId, i) => String(row[fieldId] ?? "N/A") === colParts[i]));
}
/** Pivot qator kalitidan cube rowGroupKey ni aniqlaydi. */
export function resolveRowGroupKey(rowKey, depth, config) {
    if (!config.rows.length)
        return ALL_GROUP_KEY;
    const segments = rowKey.split(" > ").map((s) => s.trim());
    const pathParts = [];
    for (let d = 0; d <= depth && d < segments.length; d++) {
        const seg = segments[d];
        const parts = seg.includes(GROUP_KEY_SEPARATOR) ? splitGroupKey(seg) : [seg];
        pathParts.push(parts[parts.length - 1] ?? seg);
    }
    if (pathParts.length === 0)
        return ALL_GROUP_KEY;
    return config.rows
        .slice(0, pathParts.length)
        .map((fieldId, i) => pathParts[i] ?? "N/A")
        .join(GROUP_KEY_SEPARATOR);
}
