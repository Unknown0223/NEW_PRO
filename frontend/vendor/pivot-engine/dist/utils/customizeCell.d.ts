import type { CustomizeCellContext, CustomizeCellFn, CustomizeCellStyle } from "../types/pivot.types.js";
export type MergedCellStyle = {
    backgroundColor?: string;
    color?: string;
    fontWeight?: string | number;
    width?: number | string;
    minWidth?: number | string;
    height?: number | string;
    className?: string;
};
/** customizeCell callback natijasini olish. */
export declare function resolveCustomizeCellStyle(customizeCell: CustomizeCellFn | undefined, ctx: CustomizeCellContext): CustomizeCellStyle | undefined;
/** Shartli format + customizeCell uslublarini birlashtiradi (customizeCell ustun). */
export declare function mergeCellStyles(conditional?: {
    backgroundColor?: string;
    textColor?: string;
}, customized?: CustomizeCellStyle): MergedCellStyle;
//# sourceMappingURL=customizeCell.d.ts.map