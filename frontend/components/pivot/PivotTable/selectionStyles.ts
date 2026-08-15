import { cn } from "@/lib/utils";
import styles from "./pivot-grid.module.css";
import type { SelectionVisual } from "./selection";

/**
 * Soft themed fill for selected cells. Outer perimeter is drawn by the
 * table-level `.selectionRangeOverlay` so sticky thead / overflow cannot
 * clip the top/side edges after mouseup.
 */
export function selectionCellClassNames(
  visual: SelectionVisual | null | undefined,
  opts?: { rowDim?: boolean }
): string | undefined {
  if (!visual?.selected) return undefined;
  return cn(
    opts?.rowDim ? styles.tdSelectedRowDim : styles.tdSelected,
    visual.focus && styles.tdSelFocus
  );
}
