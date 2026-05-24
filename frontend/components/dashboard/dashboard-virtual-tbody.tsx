"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode, type RefObject } from "react";

const VIRTUAL_THRESHOLD = 100;

export function useDashboardVirtualRows(rowCount: number, rowHeight = 36) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const enabled = rowCount > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    enabled
  });
  const virtualItems = enabled ? virtualizer.getVirtualItems() : [];
  const totalSize = enabled ? virtualizer.getTotalSize() : 0;
  const padTop = enabled ? (virtualItems[0]?.start ?? 0) : 0;
  const padBottom = enabled ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) : 0;
  return { scrollRef, enabled, virtualItems, padTop, padBottom };
}

type DashboardVirtualTableProps = {
  rowCount: number;
  colSpan: number;
  maxHeight?: number;
  scrollRef: RefObject<HTMLDivElement>;
  enabled: boolean;
  padTop: number;
  padBottom: number;
  virtualItems: Array<{ index: number }>;
  renderRows: (indices: number[]) => ReactNode;
};

/** Scroll konteyner + padding qatorlar; thead sticky qolishi uchun butun jadval ichida. */
export function DashboardVirtualTableBody({
  rowCount,
  colSpan,
  maxHeight = 520,
  scrollRef,
  enabled,
  padTop,
  padBottom,
  virtualItems,
  renderRows
}: DashboardVirtualTableProps) {
  const indices = enabled ? virtualItems.map((v) => v.index) : Array.from({ length: rowCount }, (_, i) => i);

  const body = (
    <tbody>
      {enabled && padTop > 0 ? (
        <tr aria-hidden style={{ height: padTop }}>
          <td colSpan={colSpan} className="p-0 border-none" />
        </tr>
      ) : null}
      {renderRows(indices)}
      {enabled && padBottom > 0 ? (
        <tr aria-hidden style={{ height: padBottom }}>
          <td colSpan={colSpan} className="p-0 border-none" />
        </tr>
      ) : null}
    </tbody>
  );

  if (!enabled) return body;

  return (
    <div ref={scrollRef} style={{ maxHeight, overflow: "auto" }} className="min-h-0">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        {body}
      </table>
    </div>
  );
}
