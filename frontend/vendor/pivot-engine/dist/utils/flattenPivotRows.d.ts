import type { PivotRow, PivotTotalRow } from "../types/pivot.types.js";
export type FlatPivotRowItem = {
    type: "row";
    row: PivotRow;
    depth: number;
    expanded: boolean;
    hasChildren: boolean;
    rowKey: string;
} | {
    type: "subtotal";
    subtotal: PivotTotalRow;
    depth: number;
    parentKey: string;
} | {
    type: "columnTotal";
    total: PivotTotalRow;
} | {
    type: "grandTotal";
    total: PivotTotalRow;
};
/** Virtualizatsiya uchun ko'rinadigan qatorlarni tekis ro'yxatga aylantiradi. */
export declare function flattenPivotDisplayRows(rows: PivotRow[], expandedRows: Set<string>, grandTotal?: PivotTotalRow, columnTotals?: PivotTotalRow): FlatPivotRowItem[];
//# sourceMappingURL=flattenPivotRows.d.ts.map