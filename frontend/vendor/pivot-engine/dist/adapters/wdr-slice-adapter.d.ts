import type { AggregationType, PivotConfig } from "../types/pivot.types.js";
/** WebDataRocks slice minimal shakli (clean-room, hujjat asosida). */
export type WdrSliceField = {
    uniqueName?: string;
    caption?: string;
    filter?: {
        members?: string[];
        exclude?: boolean;
    };
};
export type WdrSliceMeasure = {
    uniqueName?: string;
    aggregation?: string;
    caption?: string;
};
export type WdrSliceJson = {
    rows?: WdrSliceField[];
    columns?: WdrSliceField[];
    measures?: WdrSliceMeasure[];
    reportFilters?: WdrSliceField[];
};
export declare function mapWdrAggregation(wdrAgg?: string): AggregationType;
/** WDR ba'zan `amount.sum` kabi uniqueName ishlatadi. */
export declare function parseWdrFieldId(uniqueName?: string): string;
/**
 * WDR `slice` JSON → `PivotConfig`.
 * `reportFilters` va slice ichidagi `filter.members` qo'llab-quvvatlanadi.
 */
export declare function wdrSliceToPivotConfig(slice: WdrSliceJson, base?: Partial<PivotConfig>): PivotConfig;
/** Saqlangan WDR report (slice + ixtiyoriy dataset filtrlari). */
export type WdrSavedReport = {
    slice?: WdrSliceJson;
    savdoDatasetFilters?: Record<string, unknown>;
};
export declare function wdrReportToPivotConfig(report: WdrSavedReport): PivotConfig;
/** Saqlangan hisobot WDR `getReport()` formatidami (slice + dataSource). */
export declare function isWdrSavedReportConfig(config: unknown): config is WdrSavedReport & {
    dataSource?: unknown;
    slice: WdrSliceJson;
};
/** WDR yoki legacy PivotConfig ni aniqlash. */
export declare function detectSavedReportFormat(config: unknown): "wdr" | "pivot" | "unknown";
//# sourceMappingURL=wdr-slice-adapter.d.ts.map