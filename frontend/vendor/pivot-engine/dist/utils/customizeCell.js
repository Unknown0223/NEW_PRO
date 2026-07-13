/** customizeCell callback natijasini olish. */
export function resolveCustomizeCellStyle(customizeCell, ctx) {
    if (!customizeCell)
        return undefined;
    const result = customizeCell(ctx);
    if (!result)
        return undefined;
    return result;
}
/** Shartli format + customizeCell uslublarini birlashtiradi (customizeCell ustun). */
export function mergeCellStyles(conditional, customized) {
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
