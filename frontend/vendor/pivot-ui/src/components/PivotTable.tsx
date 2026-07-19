import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PivotCell as PivotCellType, PivotConfig, PivotData } from "@salec/pivot-engine";
import {
  flattenPivotDisplayRows,
  getConditionalFormatStyle,
  getPivotStrings,
  type FlatPivotRowItem
} from "@salec/pivot-engine";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.js";

const VIRTUAL_THRESHOLD = 80;
const ROW_HEIGHT = 34;

type Props = {
  data: PivotData;
  config: PivotConfig;
  expandedRows: Set<string>;
  onToggleRow: (key: string) => void;
  onSort?: (fieldId: string) => void;
  onCellDoubleClick?: (cell: PivotCellType) => void;
  className?: string;
};

export function PivotTable({ data, config, expandedRows, onToggleRow, onSort, onCellDoubleClick, className }: Props) {
  const t = getPivotStrings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasRowLabel = data.rows[0]?.cells.some((c) => c.columnKey === "__row_label__");
  const flatRows = useMemo(
    () => flattenPivotDisplayRows(data.rows, expandedRows, data.grandTotal, data.columnTotals),
    [data.rows, data.grandTotal, data.columnTotals, expandedRows]
  );
  const virtualEnabled = flatRows.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    enabled: virtualEnabled
  });

  const virtualItems = virtualEnabled ? virtualizer.getVirtualItems() : [];
  const padTop = virtualEnabled ? (virtualItems[0]?.start ?? 0) : 0;
  const padBottom = virtualEnabled
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  const renderIndices = virtualEnabled
    ? virtualItems.map((v) => v.index)
    : flatRows.map((_, i) => i);

  const sortField = config.options.sortBy?.fieldId;
  const sortDir = config.options.sortBy?.direction;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm", className)}>
      <div ref={scrollRef} className="max-h-[inherit] overflow-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-100">
            {data.headers.map((level, li) => (
              <tr key={`h-${li}`}>
                {li === 0 && hasRowLabel && (
                  <th
                    rowSpan={data.headers.length}
                    className="cursor-pointer border-b px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-200"
                    onClick={() => config.rows[0] && onSort?.(config.rows[0])}
                  >
                    {t.table.group}
                    {sortField === config.rows[0] && (
                      <span className="ml-1 text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </th>
                )}
                {level
                  .filter((h) => h.key !== "__row_label__")
                  .map((h) => {
                    const fieldId = headerSortFieldId(h, config, li);
                    return (
                      <th
                        key={h.key}
                        colSpan={h.colspan}
                        rowSpan={h.rowspan}
                        className={cn(
                          "border-b px-3 py-2 text-center text-xs font-semibold",
                          fieldId && onSort && "cursor-pointer hover:bg-zinc-200"
                        )}
                        onClick={() => fieldId && onSort?.(fieldId)}
                      >
                        {h.label}
                        {fieldId && sortField === fieldId && (
                          <span className="ml-1 text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </th>
                    );
                  })}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualEnabled && padTop > 0 && (
              <tr aria-hidden style={{ height: padTop }}>
                <td colSpan={99} className="border-none p-0" />
              </tr>
            )}
            {renderIndices.map((idx) => (
              <FlatRow
                key={`${flatRows[idx]?.type}-${idx}`}
                item={flatRows[idx]!}
                config={config}
                onToggleRow={onToggleRow}
                onSort={onSort}
                onCellDoubleClick={onCellDoubleClick}
              />
            ))}
            {virtualEnabled && padBottom > 0 && (
              <tr aria-hidden style={{ height: padBottom }}>
                <td colSpan={99} className="border-none p-0" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t px-3 py-1.5 text-[10px] text-zinc-500">
        {t.table.rowsMeta(
          data.metadata.processedRows.toLocaleString("ru-RU"),
          data.metadata.executionTime.toFixed(1),
          {
            virtual: virtualEnabled ? String(flatRows.length) : undefined,
            fromCache: data.metadata.fromCache,
            incremental: data.metadata.incremental
          }
        )}
      </div>
    </div>
  );
}

function headerSortFieldId(
  header: PivotData["headers"][0][0],
  config: PivotConfig,
  levelIdx: number
): string | undefined {
  if (header.isValue) {
    const match = config.values.find((v) => (v.label ?? v.fieldId) === header.label);
    return match?.fieldId ?? config.values[0]?.fieldId;
  }
  return config.columns[levelIdx];
}

function FlatRow({
  item,
  config,
  onToggleRow,
  onSort,
  onCellDoubleClick
}: {
  item: FlatPivotRowItem;
  config: PivotConfig;
  onToggleRow: (key: string) => void;
  onSort?: (fieldId: string) => void;
  onCellDoubleClick?: (cell: PivotCellType) => void;
}) {
  const rules = config.options.conditionalFormats;

  if (item.type === "columnTotal") {
    return (
      <tr className="bg-zinc-100 font-semibold">
        {item.total.cells.map((cell) => {
          const style = getConditionalFormatStyle(cell, rules);
          const drillable = Boolean(onCellDoubleClick && cell.drillContext && !cell.isEmpty);
          return (
            <td
              key={cell.columnKey}
              className={cn(
                "border-t px-3 py-2 tabular-nums",
                cell.columnKey === "__row_label__" ? "text-left" : "text-right",
                drillable && "cursor-pointer hover:bg-zinc-200"
              )}
              style={{ backgroundColor: style?.backgroundColor, color: style?.textColor }}
              onDoubleClick={drillable ? () => onCellDoubleClick!(cell) : undefined}
              title={drillable ? getPivotStrings().table.drillThroughHint : undefined}
            >
              {cell.formatted}
            </td>
          );
        })}
      </tr>
    );
  }

  if (item.type === "grandTotal") {
    return (
      <tr className="bg-zinc-100 font-semibold">
        {item.total.cells.map((cell) => {
          const style = getConditionalFormatStyle(cell, rules);
          const drillable = Boolean(onCellDoubleClick && cell.drillContext && !cell.isEmpty);
          return (
            <td
              key={cell.columnKey}
              className={cn(
                "border-t-2 px-3 py-2 tabular-nums",
                cell.columnKey === "__row_label__" ? "text-left" : "text-right",
                drillable && "cursor-pointer hover:bg-zinc-200"
              )}
              style={{
                backgroundColor: style?.backgroundColor,
                color: style?.textColor
              }}
              onDoubleClick={drillable ? () => onCellDoubleClick!(cell) : undefined}
              title={drillable ? getPivotStrings().table.drillThroughHint : undefined}
            >
              {cell.formatted}
            </td>
          );
        })}
      </tr>
    );
  }

  if (item.type === "subtotal") {
    return (
      <tr className="bg-zinc-50 font-semibold italic">
        {item.subtotal.cells.map((cell) => {
          const style = getConditionalFormatStyle(cell, rules);
          return (
            <td
              key={cell.columnKey}
              className="border-b px-3 py-1.5 tabular-nums"
              style={{
                paddingLeft: cell.columnKey === "__row_label__" ? `${12 + item.depth * 16}px` : undefined,
                backgroundColor: style?.backgroundColor,
                color: style?.textColor
              }}
            >
              {cell.formatted}
            </td>
          );
        })}
      </tr>
    );
  }

  const { row, depth, expanded, hasChildren } = item;
  const labelCell = row.cells[0];
  const valueCells = row.cells.slice(1);

  return (
    <tr className="hover:bg-zinc-50">
      {labelCell && (
        <td
          className="cursor-pointer border-b px-3 py-1.5 font-medium"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => config.rows[depth] && onSort?.(config.rows[depth])}
        >
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRow(item.rowKey);
                }}
                className="rounded p-0.5 hover:bg-zinc-200"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span>{labelCell.formatted || row.key}</span>
          </div>
        </td>
      )}
      {valueCells.map((cell) => {
        const style = getConditionalFormatStyle(cell, rules);
        const isNegative = typeof cell.rawValue === "number" && cell.rawValue < 0;
        const drillable = Boolean(onCellDoubleClick && cell.drillContext && !cell.isEmpty);
        return (
          <td
            key={cell.columnKey}
            className={cn(
              "border-b px-3 py-1.5 text-right tabular-nums",
              isNegative && !style?.textColor && "text-red-600",
              drillable && "cursor-pointer hover:bg-zinc-100 hover:underline"
            )}
            style={{ backgroundColor: style?.backgroundColor, color: style?.textColor }}
            onDoubleClick={drillable ? () => onCellDoubleClick!(cell) : undefined}
            title={drillable ? getPivotStrings().table.drillThroughHint : undefined}
          >
            {cell.formatted}
          </td>
        );
      })}
    </tr>
  );
}
