import { formatValue } from "../utils/formatters.js";
import { aggregationForColumn, valueFieldIdFromColumnKey } from "./aggregationColumnUtils.js";
function applyDifferenceToCells(cells, config, valueDefMap) {
    const prevByField = new Map();
    return cells.map((cell) => {
        if (cell.columnKey === "__row_label__")
            return cell;
        if (aggregationForColumn(cell.columnKey, config) !== "DIFFERENCE")
            return cell;
        const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
        const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
        if (!valueDef || !fieldId)
            return cell;
        const current = cell.rawValue;
        if (current == null || !Number.isFinite(current)) {
            return { ...cell, value: null, rawValue: null, formatted: "—", isEmpty: true };
        }
        const prev = prevByField.get(fieldId);
        prevByField.set(fieldId, current);
        if (prev == null) {
            return { ...cell, value: null, rawValue: null, formatted: "—", isEmpty: true };
        }
        const diff = current - prev;
        return {
            ...cell,
            value: diff,
            rawValue: diff,
            formatted: formatValue(diff, valueDef.format),
            isEmpty: false
        };
    });
}
function processRow(row, config, valueDefMap) {
    row.cells = applyDifferenceToCells(row.cells, config, valueDefMap);
    row.children?.forEach((child) => processRow(child, config, valueDefMap));
    if (row.subtotal) {
        row.subtotal = {
            ...row.subtotal,
            cells: applyDifferenceToCells(row.subtotal.cells, config, valueDefMap)
        };
    }
}
function processTotalRow(total, config, valueDefMap) {
    return {
        ...total,
        cells: applyDifferenceToCells(total.cells, config, valueDefMap)
    };
}
/** DIFFERENCE — qator bo'ylab ketma-ket qiymatlar farqi (chapdan o'ngga). */
export function applyDifferenceAggregations(data, config) {
    const hasDifference = config.values.some((v) => v.aggregation === "DIFFERENCE");
    if (!hasDifference)
        return data;
    const valueDefMap = new Map(config.values.map((v) => [v.fieldId, v]));
    const rows = data.rows.map((row) => {
        const copy = { ...row, cells: [...row.cells] };
        processRow(copy, config, valueDefMap);
        return copy;
    });
    return {
        ...data,
        rows,
        columnTotals: data.columnTotals
            ? processTotalRow(data.columnTotals, config, valueDefMap)
            : undefined,
        grandTotal: data.grandTotal ? processTotalRow(data.grandTotal, config, valueDefMap) : undefined
    };
}
