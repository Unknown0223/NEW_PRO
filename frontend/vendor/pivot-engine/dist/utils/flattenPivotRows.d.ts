import type { PivotRow, PivotTotalRow } from "../types/pivot.types.js";
export type FlatPivotRowItem = {
    type: "row";
    row: PivotRow;
    depth: number;
    expanded: boolean;
    hasChildren: boolean;
    rowKey: string;
    /**
     * Row field yo‘li: har ustun / daraja yorliqlari (CLIENT | AGENT | …).
     * Compact va Classic — ota yorliqlari bolada takrorlanadi.
     */
    pathLabels?: string[];
} | {
    type: "subtotal";
    subtotal: PivotTotalRow;
    depth: number;
    parentKey: string;
    pathLabels?: string[];
} | {
    type: "columnTotal";
    total: PivotTotalRow;
} | {
    type: "grandTotal";
    total: PivotTotalRow;
};
/**
 * Compact: ota qatori (jami yonida) + ochilganda bolalar; pastki alohida subtotal yo‘q.
 * Classic: ota har doim ko‘rinadi (jami yonida); ochilganda bolalar ostida.
 */
export declare function flattenPivotDisplayRows(rows: PivotRow[], expandedRows: Set<string>, grandTotal?: PivotTotalRow, columnTotals?: PivotTotalRow, mode?: "compact" | "classic"): FlatPivotRowItem[];
//# sourceMappingURL=flattenPivotRows.d.ts.map