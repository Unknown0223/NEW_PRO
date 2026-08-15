import type { PivotConfig, PivotData, PivotField } from "../types/pivot.types.js";
import { type DrillThroughCellContext } from "../utils/drillThrough.js";
export declare const DEFAULT_PIVOT_OPTIONS: PivotConfig["options"];
export declare const DEFAULT_PIVOT_CONFIG: PivotConfig;
export declare class PivotEngine {
    private aggregator;
    private filterEngine;
    private transformer;
    private sortEngine;
    private cubeStore;
    private cube;
    private resultCache;
    private incrementalContext;
    /** Drill-through: katakdagi manba qatorlar. */
    static getDrillThroughRecords(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig, cellContext: DrillThroughCellContext): Record<string, unknown>[];
    getDrillThroughRecords(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig, cellContext: DrillThroughCellContext): Record<string, unknown>[];
    /** CubeStore va natija keshini tozalash (testlar uchun). */
    clearCache(): void;
    get cubeCacheSize(): number;
    compute(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig): PivotData;
    private buildColSpecs;
    private buildHeaders;
    private buildCellsForData;
    private computeCell;
    /** Cube miss bo'lsa fallback (masalan, maxRows kesilgan holat). */
    private extractNumericValuesFromSubset;
    private rowMatchesColKey;
    private extractNumericValues;
    private buildFlatRow;
    private buildChildRows;
    private buildSubtotalRow;
    private buildColumnTotals;
    private buildGrandTotal;
}
//# sourceMappingURL=PivotEngine.d.ts.map