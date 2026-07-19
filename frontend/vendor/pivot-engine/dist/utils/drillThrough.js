import { FilterEngine } from "../core/FilterEngine.js";
import { ROOT_COL_KEY } from "../core/CubeBuilder.js";
import { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR, splitGroupKey } from "./groupBy.js";
import { getActiveSliceFilters } from "./sliceFilters.js";
const filterEngine = new FilterEngine();
/** Pivot kataki uchun manba qatorlarni qaytaradi. */
export function getDrillThroughRecords(rawData, fields, config, cellContext) {
    const reportScopedFilters = getActiveSliceFilters(config);
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
    const pathParts = (() => {
        const chunks = rowKey.includes(GROUP_KEY_SEPARATOR) ? splitGroupKey(rowKey) : [rowKey];
        const parts = [];
        for (const chunk of chunks) {
            if (chunk.includes(" > ")) {
                for (const p of chunk.split(" > ")) {
                    const t = p.trim();
                    if (t)
                        parts.push(t);
                }
            }
            else {
                const t = chunk.trim();
                if (t)
                    parts.push(t);
            }
        }
        return parts;
    })();
    if (pathParts.length === 0)
        return ALL_GROUP_KEY;
    const take = Math.min(depth + 1, pathParts.length, config.rows.length);
    return config.rows
        .slice(0, take)
        .map((_, i) => pathParts[i] ?? "N/A")
        .join(GROUP_KEY_SEPARATOR);
}
