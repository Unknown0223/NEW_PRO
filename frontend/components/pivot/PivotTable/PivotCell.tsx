"use client";

import type {
  ConditionalFormatRule,
  CustomizeCellContext,
  CustomizeCellFn,
  PivotCell as PivotCellType
} from "@salec/pivot-engine";
import { getConditionalFormatStyle, getPivotStrings, mergeCellStyles, resolveCustomizeCellStyle } from "@salec/pivot-engine";
import { cn } from "@/lib/utils";

type Props = {
  cell: PivotCellType;
  conditionalFormats?: ConditionalFormatRule[];
  customizeCell?: CustomizeCellFn;
  customizeContext?: Omit<CustomizeCellContext, "cell" | "config">;
  config?: CustomizeCellContext["config"];
  className?: string;
  style?: React.CSSProperties;
  onDoubleClick?: () => void;
};

export function PivotCell({
  cell,
  conditionalFormats,
  customizeCell,
  customizeContext,
  config,
  className,
  style,
  onDoubleClick
}: Props) {
  const formatStyle = getConditionalFormatStyle(cell, conditionalFormats);
  const customized = customizeCell && config
    ? resolveCustomizeCellStyle(customizeCell, { cell, config, ...customizeContext })
    : undefined;
  const merged = mergeCellStyles(formatStyle, customized);
  const isNegative = typeof cell.rawValue === "number" && cell.rawValue < 0;
  const isLabel = cell.columnKey === "__row_label__";
  const drillable = Boolean(onDoubleClick && cell.drillContext && !isLabel && !cell.isEmpty);

  return (
    <td
      className={cn(
        "border-b border-border px-3 py-1.5 text-sm tabular-nums",
        isLabel ? "text-left font-medium" : "text-right",
        isNegative && !merged.color && "text-destructive",
        cell.isEmpty && !isLabel && "text-muted-foreground",
        drillable && "cursor-pointer hover:bg-primary/5 hover:underline",
        merged.className,
        className
      )}
      style={{
        backgroundColor: merged.backgroundColor,
        color: merged.color,
        fontWeight: merged.fontWeight,
        width: merged.width ?? style?.width,
        minWidth: merged.minWidth ?? style?.minWidth,
        height: merged.height ?? style?.height,
        ...style
      }}
      onDoubleClick={drillable ? onDoubleClick : undefined}
      title={drillable ? getPivotStrings().table.drillThroughHint : undefined}
    >
      {cell.formatted || (isLabel ? "" : "—")}
    </td>
  );
}
