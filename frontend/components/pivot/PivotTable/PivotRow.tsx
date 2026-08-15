"use client";

import type { PivotRow as PivotRowType, PivotTotalRow } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PivotCell } from "./PivotCell";
import { cn } from "@/lib/utils";

type Props = {
  row: PivotRowType;
  expanded: boolean;
  onToggle?: () => void;
  depth?: number;
  conditionalFormats?: import("@salec/pivot-engine").ConditionalFormatRule[];
  customizeCell?: import("@salec/pivot-engine").CustomizeCellFn;
  config?: import("@salec/pivot-engine").PivotConfig;
  rowKey?: string;
  cellStyle?: (columnKey: string) => React.CSSProperties;
  onSortLabel?: () => void;
  onCellDoubleClick?: (cell: import("@salec/pivot-engine").PivotCell) => void;
};

export function PivotRowView({
  row,
  expanded,
  onToggle,
  depth = 0,
  conditionalFormats,
  customizeCell,
  config,
  rowKey,
  cellStyle,
  onSortLabel,
  onCellDoubleClick
}: Props) {
  const hasChildren = Boolean(row.children?.length);
  const labelCell = row.cells[0];
  const valueCells = row.cells.slice(1);

  return (
    <>
      <tr className={cn("hover:bg-muted/30", depth > 0 && "bg-muted/10")}>
        {labelCell && (
          <td
            className={cn(
              "border-b border-border px-3 py-1.5 text-sm font-medium",
              onSortLabel && "cursor-pointer hover:bg-muted/50"
            )}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={onSortLabel}
          >
            <div className="flex items-center gap-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle?.();
                  }}
                  className="shrink-0 rounded p-0.5 hover:bg-muted"
                  aria-label={expanded ? getPivotStrings().table.collapse : getPivotStrings().table.expand}
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <span className="truncate">{labelCell.formatted || row.key}</span>
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
            onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(cell) : undefined}
          />
        ))}
      </tr>
    </>
  );
}

function PivotSubtotalRow({
  subtotal,
  depth,
  conditionalFormats
}: {
  subtotal: PivotTotalRow;
  depth: number;
  conditionalFormats?: import("@salec/pivot-engine").ConditionalFormatRule[];
}) {
  const labelCell = subtotal.cells[0];
  const valueCells = subtotal.cells.slice(1);

  return (
    <tr className="bg-muted/40 font-semibold italic">
      {labelCell && (
        <td
          className="border-b border-border px-3 py-1.5 text-sm"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <div className="flex items-center gap-1 pl-5">
            <span className="truncate">{labelCell.formatted || subtotal.label}</span>
          </div>
        </td>
      )}
      {valueCells.map((cell) => (
        <PivotCell key={cell.columnKey} cell={cell} conditionalFormats={conditionalFormats} />
      ))}
    </tr>
  );
}
