import { formatValue, shouldShowCurrencySuffix } from "../utils/formatters.js";
import { aggregationForColumn, valueFieldIdFromColumnKey } from "./aggregationColumnUtils.js";
function applyDifferenceToCells(cells, config, valueDefMap, showCurrency) {
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
            formatted: formatValue(diff, valueDef.format, { showCurrency }),
            isEmpty: false
        };
    });
}
function processRow(row, config, valueDefMap, showCurrency) {
    row.cells = applyDifferenceToCells(row.cells, config, valueDefMap, showCurrency);
    row.children?.forEach((child) => processRow(child, config, valueDefMap, showCurrency));
    if (row.subtotal) {
        row.subtotal = {
            ...row.subtotal,
            cells: applyDifferenceToCells(row.subtotal.cells, config, valueDefMap, showCurrency)
        };
    }
}
function processTotalRow(total, config, valueDefMap, showCurrency) {
    return {
        ...total,
        cells: applyDifferenceToCells(total.cells, config, valueDefMap, showCurrency)
    };
}
/** DIFFERENCE — qator bo'ylab ketma-ket qiymatlar farqi (chapdan o'ngga). */
export function applyDifferenceAggregations(data, config) {
    const hasDifference = config.values.some((v) => v.aggregation === "DIFFERENCE");
    if (!hasDifference)
        return data;
    const showCurrency = shouldShowCurrencySuffix(config);
    const valueDefMap = new Map(config.values.map((v) => [v.fieldId, v]));
    const rows = data.rows.map((row) => {
        const copy = { ...row, cells: [...row.cells] };
        processRow(copy, config, valueDefMap, showCurrency);
        return copy;
    });
    return {
        ...data,
        rows,
        columnTotals: data.columnTotals
            ? processTotalRow(data.columnTotals, config, valueDefMap, showCurrency)
            : undefined,
        grandTotal: data.grandTotal
            ? processTotalRow(data.grandTotal, config, valueDefMap, showCurrency)
            : undefined
    };
}
