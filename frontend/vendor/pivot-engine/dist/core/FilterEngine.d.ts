import type { PivotField, PivotFilter } from "../types/pivot.types.js";
export declare class FilterEngine {
    apply(data: Record<string, unknown>[], filters: PivotFilter[], fields: PivotField[]): Record<string, unknown>[];
    private applyRankFilter;
    private rankScore;
    private matchesFilter;
    private toDate;
}
//# sourceMappingURL=FilterEngine.d.ts.map