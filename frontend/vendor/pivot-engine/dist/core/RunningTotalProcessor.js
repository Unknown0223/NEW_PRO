import { formatValue } from "../utils/formatters.js";
function valueFieldIdFromColumnKey(columnKey, config) {
    if (config.columns.length > 0) {
        const parts = columnKey.split("__");
        if (parts.length > 1)
            return parts.slice(1).join("__");
    }
    return config.values.find((v) => v.fieldId === columnKey)?.fieldId ?? null;
}
function aggregationForColumn(columnKey, config) {
    const fieldId = valueFieldIdFromColumnKey(columnKey, config);
    if (!fieldId)
        return null;
    return config.values.find((v) => v.fieldId === fieldId)?.aggregation ?? null;
}
function walkRows(rows, visit) {
    for (const row of rows) {
        visit(row);
        if (row.children?.length)
            walkRows(row.children, visit);
    }
}
function toRunningTotalCell(cell, cumulative, valueDef) {
    return {
        ...cell,
        value: cumulative,
        rawValue: cumulative,
        formatted: formatValue(cumulative, valueDef.format),
        isEmpty: false
    };
}
function applyRunningTotalToRows(rows, config, valueDefMap, columnRunning) {
    walkRows(rows, (row) => {
        row.cells = row.cells.map((cell) => {
            if (cell.columnKey === "__row_label__")
                return cell;
            const agg = aggregationForColumn(cell.columnKey, config);
            if (agg !== "RUNNING_TOTAL")
                return cell;
            const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
            const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
            if (!valueDef)
                return cell;
            const base = cell.rawValue ?? 0;
            const prev = columnRunning.get(cell.columnKey) ?? 0;
            const cumulative = prev + base;
            columnRunning.set(cell.columnKey, cumulative);
            return toRunningTotalCell(cell, cumulative, valueDef);
        });
        if (row.subtotal) {
            row.subtotal = applyRunningTotalToTotalRow(row.subtotal, config, valueDefMap, columnRunning);
        }
    });
}
function applyRunningTotalToTotalRow(total, config, valueDefMap, columnRunning) {
    return {
        ...total,
        cells: total.cells.map((cell) => {
            if (cell.columnKey === "__row_label__")
                return cell;
            const agg = aggregationForColumn(cell.columnKey, config);
            if (agg !== "RUNNING_TOTAL")
                return cell;
            const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
            const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
            if (!valueDef)
                return cell;
            const cumulative = columnRunning.get(cell.columnKey) ?? cell.rawValue ?? 0;
            return toRunningTotalCell(cell, cumulative, valueDef);
        })
    };
}
/**
 * RUNNING_TOTAL — qator tartibida har ustun uchun yig'indiy jami.
 * Oddiy agregatsiyadan keyin qo'llaniladi (SUM asosida).
 */
export function applyRunningTotalAggregations(data, config) {
    const hasRunning = config.values.some((v) => v.aggregation === "RUNNING_TOTAL");
    if (!hasRunning)
        return data;
    const valueDefMap = new Map(config.values.map((v) => [v.fieldId, v]));
    const columnRunning = new Map();
    const rows = data.rows.map((row) => ({ ...row, cells: [...row.cells] }));
    applyRunningTotalToRows(rows, config, valueDefMap, columnRunning);
    let columnTotals = data.columnTotals;
    if (columnTotals) {
        columnTotals = applyRunningTotalToTotalRow(columnTotals, config, valueDefMap, columnRunning);
    }
    let grandTotal = data.grandTotal;
    if (grandTotal) {
        grandTotal = applyRunningTotalToTotalRow(grandTotal, config, valueDefMap, columnRunning);
    }
    return { ...data, rows, columnTotals, grandTotal };
}
