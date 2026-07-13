import type { PivotRow, PivotTotalRow } from "../types/pivot.types.js";

export type FlatPivotRowItem =
  | {
      type: "row";
      row: PivotRow;
      depth: number;
      expanded: boolean;
      hasChildren: boolean;
      rowKey: string;
    }
  | { type: "subtotal"; subtotal: PivotTotalRow; depth: number; parentKey: string }
  | { type: "columnTotal"; total: PivotTotalRow }
  | { type: "grandTotal"; total: PivotTotalRow };

/** Virtualizatsiya uchun ko'rinadigan qatorlarni tekis ro'yxatga aylantiradi. */
export function flattenPivotDisplayRows(
  rows: PivotRow[],
  expandedRows: Set<string>,
  grandTotal?: PivotTotalRow,
  columnTotals?: PivotTotalRow
): FlatPivotRowItem[] {
  const result: FlatPivotRowItem[] = [];

  function walk(row: PivotRow, depth: number) {
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
      for (const child of row.children!) {
        walk(child, depth + 1);
      }
      if (row.subtotal) {
        result.push({ type: "subtotal", subtotal: row.subtotal, depth, parentKey: row.key });
      }
    }
  }

  for (const row of rows) walk(row, 0);
  if (columnTotals) result.push({ type: "columnTotal", total: columnTotals });
  if (grandTotal) result.push({ type: "grandTotal", total: grandTotal });
  return result;
}
