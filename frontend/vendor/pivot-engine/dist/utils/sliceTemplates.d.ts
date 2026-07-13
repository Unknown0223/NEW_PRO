import type { PivotConfig, PivotField } from "../types/pivot.types.js";
export type PivotSliceTemplate = {
    id: string;
    label: string;
    description: string;
    config: Partial<PivotConfig>;
};
export declare function getPivotSliceTemplates(): PivotSliceTemplate[];
/** Slice shablonini mavjud maydonlar bilan qo'llaydi. */
export declare function applyPivotSliceTemplate(templateId: string, fields: PivotField[], base?: PivotConfig): PivotConfig | null;
//# sourceMappingURL=sliceTemplates.d.ts.map