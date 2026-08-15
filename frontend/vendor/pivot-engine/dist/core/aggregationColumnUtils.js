export function valueFieldIdFromColumnKey(columnKey, config) {
    if (config.columns.length > 0) {
        const parts = columnKey.split("__");
        if (parts.length > 1)
            return parts.slice(1).join("__");
    }
    return config.values.find((v) => v.fieldId === columnKey)?.fieldId ?? null;
}
export function aggregationForColumn(columnKey, config) {
    const fieldId = valueFieldIdFromColumnKey(columnKey, config);
    if (!fieldId)
        return null;
    return config.values.find((v) => v.fieldId === fieldId)?.aggregation ?? null;
}
export function collectValueCells(rows) {
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
export function columnTotals(rows) {
    const totals = new Map();
    for (const cell of collectValueCells(rows)) {
        if (cell.rawValue == null || !Number.isFinite(cell.rawValue))
            continue;
        totals.set(cell.columnKey, (totals.get(cell.columnKey) ?? 0) + cell.rawValue);
    }
    return totals;
}
export function measureGrandTotals(rows, config) {
    const totals = new Map();
    for (const cell of collectValueCells(rows)) {
        const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
        if (!fieldId || cell.rawValue == null || !Number.isFinite(cell.rawValue))
            continue;
        totals.set(fieldId, (totals.get(fieldId) ?? 0) + cell.rawValue);
    }
    return totals;
}
export function rowTotals(row, measureFieldId, config) {
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
