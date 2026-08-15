import type { PivotConfig, PivotRow } from "../types/pivot.types.js";
export type SortSpec = {
    fieldId: string;
    direction: "asc" | "desc";
};
type ColSpecLike = {
    colKey: string;
    colParts: string[];
};
export declare class SortEngine {
    /** Qatorlarni `options.sortBy` bo'yicha tartiblaydi (rekursiv). */
    sortRows(rows: PivotRow[], sortBy: SortSpec | undefined, config: PivotConfig): PivotRow[];
    /** Ustun spetsifikatsiyalarini tartiblaydi. */
    sortColSpecs<T extends ColSpecLike>(colSpecs: T[], sortBy: SortSpec | undefined, config: PivotConfig): T[];
    private sortRowChildren;
    private compareRows;
    private findMeasureCell;
    private compareScalars;
}
export {};
//# sourceMappingURL=SortEngine.d.ts.map