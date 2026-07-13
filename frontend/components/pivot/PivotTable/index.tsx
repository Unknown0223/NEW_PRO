"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PivotCell as PivotCellType, PivotConfig, PivotData, CustomizeCellFn } from "@salec/pivot-engine";
import { flattenPivotDisplayRows, getPivotStrings, type FlatPivotRowItem } from "@salec/pivot-engine";
import { PivotRowView } from "./PivotRow";
import { PivotCell } from "./PivotCell";
import { cn } from "@/lib/utils";

const VIRTUAL_THRESHOLD = 80;
const DEFAULT_ROW_HEIGHT = 36;

type Props = {
  data: PivotData;
  config: PivotConfig;
  expandedRows: Set<string>;
  onToggleRow: (key: string) => void;
  onSort?: (fieldId: string) => void;
  onCellDoubleClick?: (cell: PivotCellType) => void;
  customizeCell?: CustomizeCellFn;
  className?: string;
};

export function PivotTable({ data, config, expandedRows, onToggleRow, onSort, onCellDoubleClick, customizeCell, className }: Props) {
  const t = getPivotStrings();
  const tableSizes = config.options.tableSizes;
  const rowHeight = tableSizes?.defaultRowHeight ?? DEFAULT_ROW_HEIGHT;
  const defaultColWidth = tableSizes?.defaultColumnWidth;
  const columnWidths = tableSizes?.columnWidths;
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
    estimateSize: () => rowHeight,
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
  const rules = config.options.conditionalFormats;

  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div ref={scrollRef} className="max-h-[inherit] overflow-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            {data.headers.map((level, li) => (
              <tr key={`h-${li}`}>
                {li === 0 && hasRowLabel && (
                  <th
                    rowSpan={data.headers.length}
                    className="cursor-pointer border-b border-border px-3 py-2 text-left text-xs font-semibold hover:bg-muted"
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
                          "border-b border-border px-3 py-2 text-center text-xs font-semibold",
                          fieldId && onSort && "cursor-pointer hover:bg-muted"
                        )}
                        style={{
                          width: columnWidths?.[h.key] ?? defaultColWidth,
                          minWidth: columnWidths?.[h.key] ?? defaultColWidth
                        }}
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
              <VirtualFlatRow
                key={`${flatRows[idx]?.type}-${idx}`}
                item={flatRows[idx]!}
                config={config}
                rules={rules}
                customizeCell={customizeCell}
                columnWidths={columnWidths}
                defaultColWidth={defaultColWidth}
                rowHeight={rowHeight}
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
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        {t.table.rowsMeta(
          data.metadata.processedRows.toLocaleString("ru-RU"),
          data.metadata.executionTime.toFixed(1),
          {
            virtual: virtualEnabled ? String(flatRows.length) : undefined,
            fromCache: data.metadata.fromCache,
            incremental: data.metadata.incremental
          }
        )}
        {data.metadata.warnings.length > 0 && ` · ${data.metadata.warnings.join("; ")}`}
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

function VirtualFlatRow({
  item,
  config,
  rules,
  customizeCell,
  columnWidths,
  defaultColWidth,
  rowHeight,
  onToggleRow,
  onSort,
  onCellDoubleClick
}: {
  item: FlatPivotRowItem;
  config: PivotConfig;
  rules: PivotConfig["options"]["conditionalFormats"];
  customizeCell?: CustomizeCellFn;
  columnWidths?: Record<string, number>;
  defaultColWidth?: number;
  rowHeight?: number;
  onToggleRow: (key: string) => void;
  onSort?: (fieldId: string) => void;
  onCellDoubleClick?: (cell: PivotCellType) => void;
}) {
  const cellStyle = (columnKey: string) => ({
    width: columnWidths?.[columnKey] ?? defaultColWidth,
    minWidth: columnWidths?.[columnKey] ?? defaultColWidth,
    height: rowHeight
  });

  if (item.type === "row") {
    return (
      <PivotRowView
        row={item.row}
        expanded={item.expanded}
        onToggle={() => onToggleRow(item.rowKey)}
        depth={item.depth}
        conditionalFormats={rules}
        customizeCell={customizeCell}
        config={config}
        rowKey={item.rowKey}
        rowDepth={item.depth}
        cellStyle={cellStyle}
        onSortLabel={onSort ? () => config.rows[item.depth] && onSort(config.rows[item.depth]!) : undefined}
        onCellDoubleClick={onCellDoubleClick}
      />
    );
  }

  if (item.type === "subtotal") {
    return (
      <tr className="bg-muted/40 font-semibold italic" style={{ height: rowHeight }}>
        {item.subtotal.cells.map((cell) => (
          <PivotCell
            key={cell.columnKey}
            cell={cell}
            conditionalFormats={rules}
            customizeCell={customizeCell}
            config={config}
            customizeContext={{ isSubtotal: true }}
            style={cellStyle(cell.columnKey)}
          />
        ))}
      </tr>
    );
  }

  if (item.type === "columnTotal") {
    return (
      <tr className="bg-muted/45 font-semibold" style={{ height: rowHeight }}>
        {item.total.cells.map((cell) => (
          <PivotCell
            key={cell.columnKey}
            cell={cell}
            conditionalFormats={rules}
            customizeCell={customizeCell}
            config={config}
            customizeContext={{ isColumnTotal: true }}
            style={cellStyle(cell.columnKey)}
            onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(cell) : undefined}
            className="border-t"
          />
        ))}
      </tr>
    );
  }

  return (
    <tr className="bg-muted/50 font-semibold" style={{ height: rowHeight }}>
      {item.total.cells.map((cell) => (
        <PivotCell
          key={cell.columnKey}
          cell={cell}
          conditionalFormats={rules}
          customizeCell={customizeCell}
          config={config}
          customizeContext={{ isGrandTotal: true }}
          style={cellStyle(cell.columnKey)}
          onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(cell) : undefined}
          className="border-t-2"
        />
      ))}
    </tr>
  );
}
