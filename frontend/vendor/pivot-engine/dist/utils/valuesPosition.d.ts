import type { PivotOptions, PivotValuesPosition } from "../types/pivot.types.js";
export type { PivotValuesPosition };
/** Virtual WDR «Measures» / «Σ Values» axis id (not a data field). */
export declare const PIVOT_VALUES_AXIS_ID = "__values__";
/** true if uniqueName is the WDR virtual Measures hierarchy. */
export declare function isWdrMeasuresFieldId(fieldId: string): boolean;
/** Default: columns (classic pivot — measures side by side). */
export declare function resolveValuesPosition(options?: PivotOptions): PivotValuesPosition;
export declare function valuesOnRows(options?: PivotOptions): boolean;
//# sourceMappingURL=valuesPosition.d.ts.map