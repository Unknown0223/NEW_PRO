import type { AggregationType, PivotConfig, PivotRow, PivotCell } from "../types/pivot.types.js";
export declare function valueFieldIdFromColumnKey(columnKey: string, config: PivotConfig): string | null;
export declare function aggregationForColumn(columnKey: string, config: PivotConfig): AggregationType | null;
export declare function collectValueCells(rows: PivotRow[]): PivotCell[];
export declare function columnTotals(rows: PivotRow[]): Map<string, number>;
export declare function measureGrandTotals(rows: PivotRow[], config: PivotConfig): Map<string, number>;
export declare function rowTotals(row: PivotRow, measureFieldId: string, config: PivotConfig): number;
//# sourceMappingURL=aggregationColumnUtils.d.ts.map