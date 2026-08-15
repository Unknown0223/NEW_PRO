import type { PivotConfig } from "../types/pivot.types.js";
export declare const ROOT_COL_KEY = "__root__";
/** Hash-based row×column×measure indeks — bir pass aggregation. */
export declare class CubeBuilder {
    private cube;
    build(data: Record<string, unknown>[], config: PivotConfig): void;
    /** Mavjud cube ustiga yangi qatorlarni qo'shish (incremental update). */
    appendRows(data: Record<string, unknown>[], config: PivotConfig): void;
    private ingestRows;
    getValues(rowKey: string, colKey: string, fieldId: string): number[];
    private push;
    private makeRowKeys;
    private makeColKey;
    private makeKey;
    private asNumber;
}
//# sourceMappingURL=CubeBuilder.d.ts.map