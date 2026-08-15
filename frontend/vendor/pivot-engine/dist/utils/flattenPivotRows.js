/** Virtualizatsiya uchun ko'rinadigan qatorlarni tekis ro'yxatga aylantiradi. */
export function flattenPivotDisplayRows(rows, expandedRows, grandTotal, columnTotals) {
    const result = [];
    function walk(row, depth) {
        const hasChildren = Boolean(row.children?.length);
        const expanded = expandedRows.has(row.key);
        result.push({
            type: "row",
            row,
            depth,
            expanded,
            hasChildren,
            rowKey: row.key
        });
        if (expanded && hasChildren) {
            for (const child of row.children) {
                walk(child, depth + 1);
            }
            if (row.subtotal) {
                result.push({ type: "subtotal", subtotal: row.subtotal, depth, parentKey: row.key });
            }
        }
    }
    for (const row of rows)
        walk(row, 0);
    if (columnTotals)
        result.push({ type: "columnTotal", total: columnTotals });
    if (grandTotal)
        result.push({ type: "grandTotal", total: grandTotal });
    return result;
}
