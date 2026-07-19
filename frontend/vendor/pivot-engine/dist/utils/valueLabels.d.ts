import type { PivotField, PivotValue } from "../types/pivot.types.js";
/**
 * Display caption for a measure / value field.
 * Prefer explicit PivotValue.label, then field catalog label (same as Поля chips), never raw id when a caption exists.
 */
export declare function resolvePivotValueLabel(value: Pick<PivotValue, "fieldId" | "label">, fields: PivotField[] | Map<string, PivotField>): string;
/** Attach catalog labels onto values that only have fieldId (templates / legacy saved configs). */
export declare function hydratePivotValueLabels(values: PivotValue[], fields: PivotField[]): PivotValue[];
//# sourceMappingURL=valueLabels.d.ts.map