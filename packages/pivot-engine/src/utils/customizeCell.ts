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
export function resolveCustomizeCellStyle(
  customizeCell: CustomizeCellFn | undefined,
  ctx: CustomizeCellContext
): CustomizeCellStyle | undefined {
  if (!customizeCell) return undefined;
  const result = customizeCell(ctx);
  if (!result) return undefined;
  return result;
}

/** Shartli format + customizeCell uslublarini birlashtiradi (customizeCell ustun). */
export function mergeCellStyles(
  conditional?: { backgroundColor?: string; textColor?: string },
  customized?: CustomizeCellStyle
): MergedCellStyle {
  return {
    backgroundColor: customized?.backgroundColor ?? conditional?.backgroundColor,
    color: customized?.color ?? conditional?.textColor,
    fontWeight: customized?.fontWeight,
    width: customized?.width,
    minWidth: customized?.minWidth,
    height: customized?.height,
    className: customized?.className
  };
}
