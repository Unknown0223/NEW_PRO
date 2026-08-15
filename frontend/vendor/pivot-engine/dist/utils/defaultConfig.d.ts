import type { PivotConfig, PivotField } from "../types/pivot.types.js";
/** Bo'sh konfiguratsiya uchun mantiqiy default slice: birinchi matnli qator + birinchi sonli metrika. */
export declare function createDefaultPivotConfig(fields: PivotField[]): Partial<PivotConfig>;
/** Konfiguratsiya bo'shmi (qator va qiymat yo'q). */
export declare function isEmptyPivotConfig(config: PivotConfig): boolean;
/** Maydonlar bilan to'liq default konfiguratsiya. */
export declare function resolvePivotConfig(config: PivotConfig, fields: PivotField[]): PivotConfig;
//# sourceMappingURL=defaultConfig.d.ts.map