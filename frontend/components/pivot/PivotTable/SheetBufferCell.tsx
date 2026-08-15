"use client";

import {
  EMPTY_COL_WIDTH,
  EMPTY_SHEET_COLS,
  emptySheetBufferWidth,
  hitEmptySheetColKey
} from "./sheetBuffer";
import { getSpanSelectionVisual, normalizeRange, type RangeSelection } from "./selection";
import { cn } from "@/lib/utils";
import styles from "./pivot-grid.module.css";

export function SheetBufferHeaderCell() {
  return (
    <th
      colSpan={EMPTY_SHEET_COLS}
      className={styles.thSheetBuffer}
      aria-hidden
      style={
        {
          width: emptySheetBufferWidth(),
          minWidth: emptySheetBufferWidth(),
          "--pg-empty-col-w": `${EMPTY_COL_WIDTH}px`
        } as React.CSSProperties
      }
    />
  );
}

type BodyProps = {
  rowIndex: number;
  dataColCount: number;
  selection: RangeSelection | null;
  onMouseDownSelect?: (columnKey: string, e: React.MouseEvent) => void;
  onMouseEnterSelect?: (columnKey: string) => void;
  onContextMenuSelect?: (columnKey: string, e: React.MouseEvent) => void;
  emptyCols?: number;
  emptyColWidth?: number;
};

function bufferOverlay(
  selection: RangeSelection | null,
  rowIndex: number,
  dataColCount: number,
  emptyCols: number,
  emptyColWidth: number
): { style: React.CSSProperties; className: string } | null {
  if (!selection) return null;
  const { r0, r1, c0, c1 } = normalizeRange(selection);
  if (rowIndex < r0 || rowIndex > r1) return null;
  const b0 = dataColCount;
  const b1 = dataColCount + emptyCols - 1;
  const sc0 = Math.max(c0, b0);
  const sc1 = Math.min(c1, b1);
  if (sc0 > sc1) return null;
  const visual = getSpanSelectionVisual(selection, rowIndex, sc0, sc1);
  return {
    style: {
      left: (sc0 - b0) * emptyColWidth,
      width: (sc1 - sc0 + 1) * emptyColWidth
    },
    className: cn(styles.bufferSelOverlay, visual.focus && styles.bufferSelOverlayFocus)
  };
}

/** Colspan empty-sheet buffer cell — themed fill + hit-tested selection. */
export function SheetBufferBodyCell({
  rowIndex,
  dataColCount,
  selection,
  onMouseDownSelect,
  onMouseEnterSelect,
  onContextMenuSelect,
  emptyCols = EMPTY_SHEET_COLS,
  emptyColWidth = EMPTY_COL_WIDTH
}: BodyProps) {
  const resolveKey = (e: React.MouseEvent) => {
    const left = (e.currentTarget as HTMLElement).getBoundingClientRect().left;
    return hitEmptySheetColKey(e.clientX, left, emptyColWidth, emptyCols);
  };

  const overlay = bufferOverlay(
    selection,
    rowIndex,
    dataColCount,
    emptyCols,
    emptyColWidth
  );

  return (
    <td
      colSpan={emptyCols}
      className={styles.tdSheetBuffer}
      style={
        {
          width: emptyCols * emptyColWidth,
          minWidth: emptyCols * emptyColWidth,
          "--pg-empty-col-w": `${emptyColWidth}px`
        } as React.CSSProperties
      }
      onMouseDown={(e) => onMouseDownSelect?.(resolveKey(e), e)}
      onMouseEnter={(e) => onMouseEnterSelect?.(resolveKey(e))}
      onMouseMove={(e) => onMouseEnterSelect?.(resolveKey(e))}
      onContextMenu={(e) => {
        if (!onContextMenuSelect) return;
        e.preventDefault();
        onContextMenuSelect(resolveKey(e), e);
      }}
    >
      {overlay ? <div className={overlay.className} style={overlay.style} /> : null}
    </td>
  );
}
