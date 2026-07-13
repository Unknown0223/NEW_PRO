import type { PivotConfig, PivotField } from "../types/pivot.types.js";
export interface DrillThroughCellContext {
    /** Cube qator kaliti yoki `__all__` */
    rowGroupKey: string;
    /** Ustun kaliti (`region | Yan__amount` yoki `amount`) */
    columnKey: string;
    /** Metrika maydoni */
    valueFieldId: string;
}
/** Pivot kataki uchun manba qatorlarni qaytaradi. */
export declare function getDrillThroughRecords(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig, cellContext: DrillThroughCellContext): Record<string, unknown>[];
/** Pivot qator kalitidan cube rowGroupKey ni aniqlaydi. */
export declare function resolveRowGroupKey(rowKey: string, depth: number, config: PivotConfig): string;
//# sourceMappingURL=drillThrough.d.ts.map