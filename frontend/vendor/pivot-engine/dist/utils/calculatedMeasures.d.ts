import type { CalculatedMeasure, PivotConfig, PivotField } from "../types/pivot.types.js";
/** Hisoblangan metrikalarni qatorlarga qo'shadi (cube build dan oldin). */
export declare function applyCalculatedMeasures(data: Record<string, unknown>[], measures: CalculatedMeasure[], fields: PivotField[]): Record<string, unknown>[];
/** PivotField ro'yxatiga hisoblangan metrikalarni qo'shadi. */
export declare function calculatedMeasuresToFields(measures: CalculatedMeasure[]): PivotField[];
/** PivotConfig dan barcha hisoblangan metrikalarni qaytaradi. */
export declare function getConfigCalculatedMeasures(config: PivotConfig): CalculatedMeasure[];
/** SavdoDesk retrobonus tierlari — Aggregator.calculateRetrobonus bilan mos. */
export declare const RETROBONUS_TIER_PRESETS: Array<{
    id: string;
    label: string;
    tiers: Array<{
        minVolume: number;
        percent: number;
    }>;
    description: string;
}>;
/** Oldindan belgilangan formulalar (UI preset) — joriy til bo'yicha. */
export declare function getCalculatedMeasurePresets(): import("../index.js").CalculatedMeasurePreset[];
/** @deprecated `getCalculatedMeasurePresets()` ishlating */
export declare const CALCULATED_MEASURE_PRESETS: import("../index.js").CalculatedMeasurePreset[];
//# sourceMappingURL=calculatedMeasures.d.ts.map