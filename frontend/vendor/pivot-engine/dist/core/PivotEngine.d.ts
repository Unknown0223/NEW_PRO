import type { PivotConfig, PivotData, PivotField } from "../types/pivot.types.js";
import { type DrillThroughCellContext } from "../utils/drillThrough.js";
export { DEFAULT_PIVOT_CONFIG, DEFAULT_PIVOT_OPTIONS } from "./defaults.js";
export declare class PivotEngine {
    private aggregator;
    private filterEngine;
    private transformer;
    private sortEngine;
    private cubeStore;
    private cube;
    private resultCache;
    private incrementalContext;
    /** 2+ turli valyuta bo‘lsa formatda soʻm/USD ko‘rsatiladi. */
    private showCurrencySuffix;
    /** Drill-through: katakdagi manba qatorlar. */
    static getDrillThroughRecords(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig, cellContext: DrillThroughCellContext): Record<string, unknown>[];
    getDrillThroughRecords(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig, cellContext: DrillThroughCellContext): Record<string, unknown>[];
    /** CubeStore va natija keshini tozalash (testlar uchun). */
    clearCache(): void;
    get cubeCacheSize(): number;
    compute(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig): PivotData;
    private buildColSpecs;
    private buildHeaders;
    private buildEmptyLabelCells;
    private buildMeasureChildRows;
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