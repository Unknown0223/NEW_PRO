import type { PivotLocale, PivotStrings } from "./types.js";
/** Joriy pivot UI tili (default: ru). */
export declare function getPivotLocale(): PivotLocale;
export declare function setPivotLocale(locale: PivotLocale): void;
/** Joriy til uchun barcha UI matnlari. */
export declare function getPivotStrings(): PivotStrings;
export declare function getAggregationLabel(aggregation: keyof PivotStrings["aggregations"]): string;
export type { PivotLocale, PivotStrings, CalculatedMeasurePreset } from "./types.js";
//# sourceMappingURL=index.d.ts.map