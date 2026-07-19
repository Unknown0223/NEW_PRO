import type { PivotConfig, PivotData, PivotField } from "../types/pivot.types.js";
/** Flat jadval ustun tartibi: rows → columns → values (takrorlarsiz).
 * Report filters — faqat filtr, ustun emas (WDR flat).
 */
export declare function getFlatColumnFieldIds(config: PivotConfig): string[];
/**
 * WDR flat form: agregatsiyasiz raw qatorlar, har maydon alohida ustun.
 */
export declare function buildFlatPivotData(rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig, startTime?: number): PivotData;
//# sourceMappingURL=buildFlatPivotData.d.ts.map