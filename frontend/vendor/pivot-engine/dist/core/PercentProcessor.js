import { formatValue } from "../utils/formatters.js";
const PERCENT_TYPES = [
    "PERCENT_OF_TOTAL",
    "PERCENT_OF_ROW",
    "PERCENT_OF_COLUMN"
];
function isPercentAggregation(aggregation) {
    return PERCENT_TYPES.includes(aggregation);
}
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
function percentFormat(valueDef) {
    return valueDef.format ?? { type: "percent", decimals: 1 };
}
function toPercentCell(cell, numerator, denominator, valueDef) {
    if (numerator == null || denominator == null || denominator === 0) {
        return {
            ...cell,
            value: null,
            rawValue: null,
            formatted: "—",
            isEmpty: true
        };
    }
    const pct = (numerator / denominator) * 100;
    return {
        ...cell,
        value: pct,
        rawValue: pct,
        formatted: formatValue(pct, percentFormat(valueDef)),
        isEmpty: false
    };
}
function collectValueCells(rows) {
    const cells = [];
    function walk(row) {
        for (const cell of row.cells) {
            if (cell.columnKey !== "__row_label__")
                cells.push(cell);
        }
        row.children?.forEach(walk);
        if (row.subtotal) {
            for (const cell of row.subtotal.cells) {
                if (cell.columnKey !== "__row_label__")
                    cells.push(cell);
            }
        }
    }
    rows.forEach(walk);
    return cells;
}
function columnTotals(rows) {
    const totals = new Map();
    for (const cell of collectValueCells(rows)) {
        if (cell.rawValue == null || !Number.isFinite(cell.rawValue))
            continue;
        totals.set(cell.columnKey, (totals.get(cell.columnKey) ?? 0) + cell.rawValue);
    }
    return totals;
}
/** Metrika bo'yicha umumiy jami (barcha ustunlar). */
function measureGrandTotals(rows, config) {
    const totals = new Map();
    for (const cell of collectValueCells(rows)) {
        const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
        if (!fieldId || cell.rawValue == null || !Number.isFinite(cell.rawValue))
            continue;
        totals.set(fieldId, (totals.get(fieldId) ?? 0) + cell.rawValue);
    }
    return totals;
}
function rowTotals(row, measureFieldId, config) {
    let sum = 0;
    for (const cell of row.cells) {
        if (cell.columnKey === "__row_label__")
            continue;
        const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
        if (fieldId !== measureFieldId)
            continue;
        if (cell.rawValue != null && Number.isFinite(cell.rawValue))
            sum += cell.rawValue;
    }
    return sum;
}
function processRowCells(row, config, colTotals, measureTotals, valueDefMap) {
    row.cells = row.cells.map((cell) => {
        if (cell.columnKey === "__row_label__")
            return cell;
        const agg = aggregationForColumn(cell.columnKey, config);
        if (!agg || !isPercentAggregation(agg))
            return cell;
        const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
        const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
        if (!valueDef)
            return cell;
        const numerator = cell.rawValue;
        let denominator = null;
        if (agg === "PERCENT_OF_TOTAL") {
            denominator = fieldId ? (measureTotals.get(fieldId) ?? null) : null;
        }
        else if (agg === "PERCENT_OF_ROW") {
            denominator = rowTotals(row, valueDef.fieldId, config);
        }
        else if (agg === "PERCENT_OF_COLUMN") {
            denominator = colTotals.get(cell.columnKey) ?? null;
        }
        return toPercentCell(cell, numerator, denominator, valueDef);
    });
    row.children?.forEach((child) => processRowCells(child, config, colTotals, measureTotals, valueDefMap));
    if (row.subtotal) {
        row.subtotal = processTotalRow(row.subtotal, config, colTotals, measureTotals, valueDefMap, row);
    }
}
function processTotalRow(total, config, colTotals, measureTotals, valueDefMap, parentRow) {
    return {
        ...total,
        cells: total.cells.map((cell) => {
            if (cell.columnKey === "__row_label__")
                return cell;
            const agg = aggregationForColumn(cell.columnKey, config);
            if (!agg || !isPercentAggregation(agg))
                return cell;
            const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
            const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
            if (!valueDef)
                return cell;
            const numerator = cell.rawValue;
            let denominator = null;
            if (agg === "PERCENT_OF_TOTAL" && fieldId) {
                denominator = measureTotals.get(fieldId) ?? null;
            }
            else if (agg === "PERCENT_OF_COLUMN") {
                denominator = colTotals.get(cell.columnKey) ?? null;
            }
            else if (agg === "PERCENT_OF_ROW" && parentRow) {
                denominator = rowTotals(parentRow, valueDef.fieldId, config);
            }
            else if (agg === "PERCENT_OF_ROW") {
                denominator = colTotals.get(cell.columnKey) ?? null;
            }
            return toPercentCell(cell, numerator, denominator, valueDef);
        })
    };
}
/**
 * PERCENT_OF_TOTAL / ROW / COLUMN — barcha oddiy agregatsiyalar hisoblangandan keyin.
 */
export function applyPercentAggregations(data, config) {
    const hasPercent = config.values.some((v) => isPercentAggregation(v.aggregation));
    if (!hasPercent)
        return data;
    const valueDefMap = new Map(config.values.map((v) => [v.fieldId, v]));
    const colTotals = columnTotals(data.rows);
    const measureTotals = measureGrandTotals(data.rows, config);
    const rows = data.rows.map((row) => {
        const copy = { ...row, cells: [...row.cells] };
        processRowCells(copy, config, colTotals, measureTotals, valueDefMap);
        return copy;
    });
    let grandTotal = data.grandTotal;
    if (grandTotal) {
        grandTotal = processTotalRow(grandTotal, config, colTotals, measureTotals, valueDefMap);
    }
    return { ...data, rows, grandTotal };
}
