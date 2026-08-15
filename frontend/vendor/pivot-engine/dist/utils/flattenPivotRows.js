function rowLabel(row) {
    const labelCell = row.cells.find((c) => c.columnKey === "__row_label__") ?? row.cells[0];
    return String(labelCell?.formatted ?? labelCell?.value ?? row.key);
}
/**
 * Compact: ota qatori + ochilganda bolalar (daraxt); pathLabels — har field alohida ustun.
 * Classic: ochilganda ota alohida qator emas — bola bilan bir xil horizontal
 *          pathLabels (Client | Agent bir qatorda).
 */
export function flattenPivotDisplayRows(rows, expandedRows, grandTotal, columnTotals, mode = "compact") {
    const result = [];
    function walkCompact(row, ancestors, depth) {
        const hasChildren = Boolean(row.children?.length);
        const expanded = expandedRows.has(row.key);
        const label = rowLabel(row);
        const pathLabels = [...ancestors, label];
        result.push({
            type: "row",
            row,
            depth,
            expanded,
            hasChildren,
            rowKey: row.key,
            pathLabels
        });
        if (expanded && hasChildren) {
            for (const child of row.children) {
                walkCompact(child, pathLabels, depth + 1);
            }
            if (row.subtotal) {
                result.push({
                    type: "subtotal",
                    subtotal: row.subtotal,
                    depth,
                    parentKey: row.key,
                    pathLabels
                });
            }
        }
    }
    function walkClassic(row, ancestors, depth) {
        const hasChildren = Boolean(row.children?.length);
        const expanded = expandedRows.has(row.key);
        const label = rowLabel(row);
        // Ota yorliqlari har bola qatorida takrorlanadi — blank/suppress YO‘Q
        const pathLabels = [...ancestors, label];
        if (expanded && hasChildren) {
            for (const child of row.children) {
                walkClassic(child, pathLabels, depth + 1);
            }
            if (row.subtotal) {
                result.push({
                    type: "subtotal",
                    subtotal: row.subtotal,
                    depth,
                    parentKey: row.key,
                    pathLabels
                });
            }
            return;
        }
        result.push({
            type: "row",
            row,
            depth,
            expanded,
            hasChildren,
            rowKey: row.key,
            pathLabels
        });
    }
    if (mode === "classic") {
        for (const row of rows)
            walkClassic(row, [], 0);
    }
    else {
        for (const row of rows)
            walkCompact(row, [], 0);
    }
    if (columnTotals)
        result.push({ type: "columnTotal", total: columnTotals });
    if (grandTotal)
        result.push({ type: "grandTotal", total: grandTotal });
    return result;
}
