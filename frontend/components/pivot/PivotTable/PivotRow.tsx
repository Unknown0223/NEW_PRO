"use client";

import type { PivotRow as PivotRowType } from "@salec/pivot-engine";
import { PivotCell } from "./PivotCell";
import { ExpandSpacer, ExpandToggle } from "./ExpandToggle";
import { cn } from "@/lib/utils";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import { formatPivotMemberLabel } from "@/lib/pivot-member-labels";
import { blankRepeatedParentLabels, classicPathPrefixKey, splitPivotRowPath } from "@/lib/pivot-flatten";
import styles from "./pivot-grid.module.css";
import { isStickyRowDimLeft, ROW_GUTTER_W } from "./columnSizing";
import { SheetBufferBodyCell } from "./SheetBufferCell";
import type { RangeSelection, SelectionVisual } from "./selection";
import { selectionCellClassNames } from "./selectionStyles";

type CellPointerHandlers = {
  onMouseDownSelect?: (columnKey: string, e: React.MouseEvent) => void;
  onMouseEnterSelect?: (columnKey: string) => void;
  onContextMenuSelect?: (
    columnKey: string,
    e: React.MouseEvent,
    cell?: import("@salec/pivot-engine").PivotCell | null
  ) => void;
};

type Props = {
  row: PivotRowType;
  expanded: boolean;
  onToggle?: () => void;
  /** Classic: har ustun prefiksi uchun expand holati */
  expandedRows?: Set<string>;
  /** Classic: faqat shu path prefiksini ochib/yopadi */
  onTogglePath?: (pathKey: string) => void;
  depth?: number;
  pathLabels?: string[];
  /** Classic: oldingi qatorning to‘liq pathLabels — takroriy otalarni blank qilish uchun */
  previousPathLabels?: string[] | null;
  conditionalFormats?: import("@salec/pivot-engine").ConditionalFormatRule[];
  customizeCell?: import("@salec/pivot-engine").CustomizeCellFn;
  config?: import("@salec/pivot-engine").PivotConfig;
  rowKey?: string;
  cellStyle?: (columnKey: string) => React.CSSProperties;
  onSortLabel?: () => void;
  onCellDoubleClick?: (cell: import("@salec/pivot-engine").PivotCell) => void;
  /** columnKey → selected in current range */
  isColumnSelected?: (columnKey: string) => boolean;
  /** columnKey → Excel-like selection visual (fill + outer edges) */
  getCellSelection?: (columnKey: string) => SelectionVisual;
  onSelectCell?: (columnKey: string) => void;
  cellPointer?: CellPointerHandlers;
  rowDimLefts?: number[];
  /** Measured widths for sticky row-dim columns. */
  columnWidthsResolved?: Record<string, number>;
  /** Excel-style 1-based row index gutter (non-selectable). */
  rowGutterNumber?: number;
  /** Empty sheet buffer columns after data (Excel/WDR). */
  emptySheetCols?: number;
  emptyColWidth?: number;
  /** Excel-like zebra band for this data row. */
  banded?: boolean;
  /** Absolute flat-row index (for buffer selection). */
  rowIndex?: number;
  /** Data column count — buffer selection cols start after this. */
  dataColCount?: number;
  selection?: RangeSelection | null;
};

/**
 * Classic/Compact multi-column labels: pathLabels (walk) birinchi.
 * Key bilan boyitiladi; depth-only blank fallback faqat hech narsa yo‘q bo‘lsa.
 */
export function resolveClassicLabels(
  pathLabels: string[] | undefined,
  row: PivotRowType,
  depth: number,
  rowFieldCount: number
): string[] {
  const fromKey = splitPivotRowPath(row.key);
  const labelCell = row.cells.find((c) => c.columnKey === "__row_label__") ?? row.cells[0];
  const self = String(labelCell?.formatted ?? labelCell?.value ?? fromKey[fromKey.length - 1] ?? row.key);

  return Array.from({ length: rowFieldCount }, (_, i) => {
    const fromPath = pathLabels?.[i];
    if (fromPath != null && String(fromPath).trim() !== "") return String(fromPath);
    const keyPart = fromKey[i];
    if (keyPart != null && String(keyPart).trim() !== "") return String(keyPart);
    if (i === depth) return self;
    return "";
  });
}

export function PivotRowView({
  row,
  expanded,
  onToggle,
  expandedRows,
  onTogglePath,
  depth = 0,
  pathLabels,
  previousPathLabels,
  conditionalFormats,
  customizeCell,
  config,
  rowKey,
  cellStyle,
  onSortLabel,
  onCellDoubleClick,
  isColumnSelected,
  getCellSelection,
  onSelectCell,
  cellPointer,
  rowDimLefts,
  columnWidthsResolved,
  rowGutterNumber,
  emptySheetCols = 0,
  emptyColWidth = 100,
  banded = false,
  rowIndex = 0,
  dataColCount = 0,
  selection = null
}: Props) {
  const bufferCell =
    emptySheetCols > 0 ? (
      <SheetBufferBodyCell
        rowIndex={rowIndex}
        dataColCount={dataColCount}
        selection={selection}
        emptyCols={emptySheetCols}
        emptyColWidth={emptyColWidth}
        onMouseDownSelect={(key, e) => cellPointer?.onMouseDownSelect?.(key, e)}
        onMouseEnterSelect={(key) => cellPointer?.onMouseEnterSelect?.(key)}
        onContextMenuSelect={(key, e) => cellPointer?.onContextMenuSelect?.(key, e)}
      />
    ) : null;
  const hasChildren = Boolean(row.children?.length);
  const layoutForm = resolveLayoutForm(config?.options);
  const rowFieldCount = config?.rows.length ?? 0;
  const isClassic = layoutForm === "classic" && rowFieldCount > 1;
  const isCompactMulti = layoutForm === "compact" && rowFieldCount > 1;
  /** Flat / raw rows have no synthetic label — do NOT clone cells[0] into a sticky col. */
  const hasSyntheticRowLabel = row.cells.some((c) => c.columnKey === "__row_label__");
  const labelCell = hasSyntheticRowLabel
    ? row.cells.find((c) => c.columnKey === "__row_label__")
    : null;
  const valueCells = hasSyntheticRowLabel
    ? row.cells.filter((c) => c.columnKey !== "__row_label__")
    : row.cells;

  if (isClassic || isCompactMulti) {
    const fullLabels = resolveClassicLabels(pathLabels, row, depth, rowFieldCount);
    // Klassik: chapdan bir xil otalar blank; compact: to‘liq. Expand kaliti — fullLabels.
    const labels = isClassic
      ? blankRepeatedParentLabels(fullLabels, previousPathLabels)
      : fullLabels;
    let lastStickyIdx = -1;
    if (rowDimLefts?.length) {
      for (let i = 0; i < rowDimLefts.length; i++) {
        if (isStickyRowDimLeft(rowDimLefts[i])) lastStickyIdx = i;
      }
    }

    return (
      <tr className={cn(styles.trHover, banded && styles.trBanded)}>
        {rowGutterNumber != null && (
          <td className={styles.tdRowGutter} aria-hidden>
            {rowGutterNumber}
          </td>
        )}
        {Array.from({ length: rowFieldCount }, (_, colIdx) => {
          const rawLabel = labels[colIdx] ?? "";
          const text = rawLabel
            ? formatPivotMemberLabel(config?.rows[colIdx], rawLabel)
            : "";
          const dimKey = `__row_dim_${colIdx}__`;
          const dimW = columnWidthsResolved?.[dimKey] ?? cellStyle?.(dimKey)?.width ?? 100;
          const leftRaw = rowDimLefts?.[colIdx];
          const sticky = isStickyRowDimLeft(leftRaw);
          const baseStyle: React.CSSProperties = {
            minWidth: dimW,
            width: dimW,
            maxWidth: dimW,
            ...(sticky ? { left: leftRaw, zIndex: 10 - colIdx } : { zIndex: 1 })
          };
          const dimVisual =
            getCellSelection?.(dimKey) ??
            (isColumnSelected?.(dimKey)
              ? { selected: true, top: true, right: true, bottom: true, left: true, focus: false }
              : null);
          const dimClass = cn(
            styles.td,
            styles.tdRowDim,
            sticky && styles.tdRowDimSticky,
            sticky && colIdx === lastStickyIdx && styles.tdRowDimStickyLast,
            styles.tdLabel,
            selectionCellClassNames(dimVisual, { rowDim: true })
          );

          if (isCompactMulti) {
            const showToggle = hasChildren && colIdx === depth && Boolean(text);
            return (
              <td
                key={`row-dim-${colIdx}`}
                className={cn(dimClass, showToggle && onSortLabel && "cursor-pointer")}
                style={{
                  ...baseStyle,
                  ...(colIdx === depth ? { paddingLeft: `${6 + depth * 12}px` } : undefined)
                }}
                onClick={() => {
                  onSelectCell?.(dimKey);
                  if (showToggle) onSortLabel?.();
                }}
                onMouseDown={(e) => cellPointer?.onMouseDownSelect?.(dimKey, e)}
                onMouseEnter={() => cellPointer?.onMouseEnterSelect?.(dimKey)}
                onContextMenu={(e) => cellPointer?.onContextMenuSelect?.(dimKey, e)}
              >
                {text || showToggle ? (
                  <div className={styles.cellInner}>
                    {showToggle ? (
                      <ExpandToggle expanded={expanded} onToggle={() => onToggle?.()} />
                    ) : colIdx === depth ? (
                      <ExpandSpacer />
                    ) : null}
                    {text ? <span className={styles.cellText}>{text}</span> : null}
                  </div>
                ) : null}
              </td>
            );
          }

          // Classic: ± faqat matn ko‘rinadigan katakda (blank katakda − bo‘lmasin)
          const isLeafCol = colIdx >= rowFieldCount - 1;
          const fullAtCol = fullLabels[colIdx] ?? "";
          const prefixKey = !isLeafCol ? classicPathPrefixKey(fullLabels, colIdx) : null;
          const showToggle = Boolean(prefixKey && text && fullAtCol);
          const colExpanded = prefixKey ? (expandedRows?.has(prefixKey) ?? expanded) : false;
          return (
            <td
              key={`row-dim-${colIdx}`}
              className={cn(dimClass, showToggle && onSortLabel && "cursor-pointer")}
              style={baseStyle}
              onClick={() => {
                onSelectCell?.(dimKey);
                if (showToggle) onSortLabel?.();
              }}
              onMouseDown={(e) => cellPointer?.onMouseDownSelect?.(dimKey, e)}
              onMouseEnter={() => cellPointer?.onMouseEnterSelect?.(dimKey)}
              onContextMenu={(e) => cellPointer?.onContextMenuSelect?.(dimKey, e)}
            >
              {text || showToggle ? (
                <div className={styles.cellInner}>
                  {showToggle && prefixKey ? (
                    <ExpandToggle
                      expanded={colExpanded}
                      onToggle={() => {
                        if (onTogglePath) onTogglePath(prefixKey);
                        else onToggle?.();
                      }}
                    />
                  ) : null}
                  {text ? <span className={styles.cellText}>{text}</span> : null}
                </div>
              ) : null}
            </td>
          );
        })}
        {valueCells.map((cell) => (
          <PivotCell
            key={cell.columnKey}
            cell={cell}
            conditionalFormats={conditionalFormats}
            customizeCell={customizeCell}
            config={config}
            customizeContext={{ rowKey, rowDepth: depth }}
            style={cellStyle?.(cell.columnKey)}
            selectionVisual={getCellSelection?.(cell.columnKey)}
            selected={isColumnSelected?.(cell.columnKey) ?? false}
            onSelect={() => onSelectCell?.(cell.columnKey)}
            onMouseDownSelect={(e) => cellPointer?.onMouseDownSelect?.(cell.columnKey, e)}
            onMouseEnterSelect={() => cellPointer?.onMouseEnterSelect?.(cell.columnKey)}
            onContextMenuSelect={(e) => cellPointer?.onContextMenuSelect?.(cell.columnKey, e, cell)}
            onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(cell) : undefined}
          />
        ))}
        {bufferCell}
      </tr>
    );
  }

  const labelVisual =
    getCellSelection?.("__row_label__") ??
    (isColumnSelected?.("__row_label__")
      ? { selected: true, top: true, right: true, bottom: true, left: true, focus: false }
      : null);

  return (
    <tr className={cn(styles.trHover, banded && styles.trBanded)}>
      {rowGutterNumber != null && (
        <td className={styles.tdRowGutter} aria-hidden>
          {rowGutterNumber}
        </td>
      )}
      {labelCell && (
        <td
          className={cn(
            styles.td,
            styles.tdRowDim,
            styles.tdLabel,
            selectionCellClassNames(labelVisual, { rowDim: true }),
            onSortLabel && "cursor-pointer"
          )}
          style={{
            minWidth: columnWidthsResolved?.["__row_label__"] ?? cellStyle?.("__row_label__")?.width ?? 100,
            width: columnWidthsResolved?.["__row_label__"] ?? cellStyle?.("__row_label__")?.width ?? 100,
            maxWidth: columnWidthsResolved?.["__row_label__"] ?? cellStyle?.("__row_label__")?.width ?? 100,
            paddingLeft: `${6 + depth * 14}px`
          }}
          onClick={() => {
            onSelectCell?.("__row_label__");
            onSortLabel?.();
          }}
          onMouseDown={(e) => cellPointer?.onMouseDownSelect?.("__row_label__", e)}
          onMouseEnter={() => cellPointer?.onMouseEnterSelect?.("__row_label__")}
          onContextMenu={(e) => cellPointer?.onContextMenuSelect?.("__row_label__", e, labelCell)}
        >
          <div className={styles.cellInner}>
            {hasChildren ? (
              <ExpandToggle expanded={expanded} onToggle={() => onToggle?.()} />
            ) : (
              <ExpandSpacer />
            )}
            <span className={styles.cellText}>
              {formatPivotMemberLabel(
                config?.rows[Math.min(depth, Math.max(0, (config?.rows.length ?? 1) - 1))],
                labelCell.formatted || row.key
              )}
            </span>
          </div>
        </td>
      )}
      {valueCells.map((cell) => (
        <PivotCell
          key={cell.columnKey}
          cell={cell}
          conditionalFormats={conditionalFormats}
          customizeCell={customizeCell}
          config={config}
          customizeContext={{ rowKey, rowDepth: depth }}
          style={cellStyle?.(cell.columnKey)}
          selectionVisual={getCellSelection?.(cell.columnKey)}
          selected={isColumnSelected?.(cell.columnKey) ?? false}
          onSelect={() => onSelectCell?.(cell.columnKey)}
          onMouseDownSelect={(e) => cellPointer?.onMouseDownSelect?.(cell.columnKey, e)}
          onMouseEnterSelect={() => cellPointer?.onMouseEnterSelect?.(cell.columnKey)}
          onContextMenuSelect={(e) => cellPointer?.onContextMenuSelect?.(cell.columnKey, e, cell)}
          onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(cell) : undefined}
        />
      ))}
      {bufferCell}
    </tr>
  );
}
