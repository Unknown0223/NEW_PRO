import type { ConditionalFormatRule, PivotCell } from "../types/pivot.types.js";
export type ConditionalFormatStyle = {
    backgroundColor?: string;
    textColor?: string;
};
/** Birinchi mos qoida uslubini qaytaradi (WDR conditional formatting soddalashtirilgan). */
export declare function getConditionalFormatStyle(cell: PivotCell, rules: ConditionalFormatRule[] | undefined): ConditionalFormatStyle | undefined;
//# sourceMappingURL=conditionalFormat.d.ts.map