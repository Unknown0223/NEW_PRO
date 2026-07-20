"use client";

import type {
  ConditionalFormatRule,
  CustomizeCellContext,
  CustomizeCellFn,
  PivotCell as PivotCellType
} from "@salec/pivot-engine";
import { getConditionalFormatStyle, getPivotStrings, mergeCellStyles, resolveCustomizeCellStyle } from "@salec/pivot-engine";
import { cn } from "@/lib/utils";
import styles from "./pivot-grid.module.css";
import type { SelectionVisual } from "./selection";
import { selectionCellClassNames } from "./selectionStyles";

type Props = {
  cell: PivotCellType;
  conditionalFormats?: ConditionalFormatRule[];
  customizeCell?: CustomizeCellFn;
  customizeContext?: Omit<CustomizeCellContext, "cell" | "config">;
  config?: CustomizeCellContext["config"];
  className?: string;
  style?: React.CSSProperties;
  onDoubleClick?: () => void;
  /** @deprecated Prefer selectionVisual */
  selected?: boolean;
  selectionVisual?: SelectionVisual | null;
  onSelect?: () => void;
  onMouseDownSelect?: (e: React.MouseEvent) => void;
  onMouseEnterSelect?: () => void;
  onContextMenuSelect?: (e: React.MouseEvent) => void;
  variant?: "value" | "label" | "rowDim";
};

export function PivotCell({
  cell,
  conditionalFormats,
  customizeCell,
  customizeContext,
  config,
  className,
  style,
  onDoubleClick,
  selected,
  selectionVisual,
  onSelect,
  onMouseDownSelect,
  onMouseEnterSelect,
  onContextMenuSelect,
  variant = "value"
}: Props) {
  const formatStyle = getConditionalFormatStyle(cell, conditionalFormats);
  const customized =
    customizeCell && config
      ? resolveCustomizeCellStyle(customizeCell, { cell, config, ...customizeContext })
      : undefined;
  const merged = mergeCellStyles(formatStyle, customized);
  const isNegative = typeof cell.rawValue === "number" && cell.rawValue < 0;
  const isLabel = variant === "label" || cell.columnKey === "__row_label__";
  const isRowDim = variant === "rowDim";
  const drillable = Boolean(
    onDoubleClick && cell.drillContext && !isLabel && !isRowDim && !cell.isEmpty
  );
  const visual =
    selectionVisual ??
    (selected
      ? { selected: true, top: true, right: true, bottom: true, left: true, focus: false }
      : null);

  const cellStyle: React.CSSProperties = {
    ...style,
    width: merged.width ?? style?.width,
    minWidth: merged.minWidth ?? style?.minWidth,
    height: merged.height ?? style?.height,
    color: merged.color ?? style?.color,
    fontWeight: merged.fontWeight ?? style?.fontWeight
  };
  if (merged.backgroundColor) {
    cellStyle.backgroundColor = merged.backgroundColor;
  }

  return (
    <td
      className={cn(
        styles.td,
        isRowDim ? styles.tdRowDim : isLabel ? styles.tdLabel : styles.tdNumeric,
        selectionCellClassNames(visual, { rowDim: isRowDim }),
        isNegative && !merged.color && styles.tdNegative,
        cell.isEmpty && !isLabel && !isRowDim && styles.tdEmpty,
        drillable && styles.tdDrillable,
        merged.className,
        className
      )}
      style={cellStyle}
      onClick={onSelect}
      onMouseDown={onMouseDownSelect}
      onMouseEnter={onMouseEnterSelect}
      onContextMenu={onContextMenuSelect}
      onDoubleClick={drillable ? onDoubleClick : undefined}
      title={
        drillable
          ? getPivotStrings().table.drillThroughHint
          : cell.formatted
            ? String(cell.formatted)
            : undefined
      }
    >
      {cell.formatted || (isLabel || isRowDim ? "" : "—")}
    </td>
  );
}
