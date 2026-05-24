"use client";

import { memo, type ReactNode, type RefObject } from "react";
import { useDashboardVirtualRows } from "@/components/dashboard/dashboard-virtual-tbody";

export const SupervisorVisitTableRow = memo(function SupervisorVisitTableRow({
  children
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
});

export function SupervisorVisitsSection({
  sectionRef,
  rowCount,
  children,
  renderRows
}: {
  sectionRef?: RefObject<HTMLDivElement>;
  rowCount: number;
  children?: ReactNode;
  renderRows: (indices: number[]) => ReactNode;
}) {
  const virtual = useDashboardVirtualRows(rowCount);
  return (
    <div ref={sectionRef} data-dashboard-section="supervisor-visits">
      {children}
      <div
        ref={virtual.enabled ? virtual.scrollRef : undefined}
        style={virtual.enabled ? { maxHeight: 480, overflow: "auto" } : undefined}
      >
        <table className="w-full border-collapse text-sm">
          <tbody>
            {virtual.enabled && virtual.padTop > 0 ? (
              <tr aria-hidden style={{ height: virtual.padTop }}>
                <td colSpan={20} />
              </tr>
            ) : null}
            {renderRows(
              virtual.enabled
                ? virtual.virtualItems.map((v) => v.index)
                : Array.from({ length: rowCount }, (_, i) => i)
            )}
            {virtual.enabled && virtual.padBottom > 0 ? (
              <tr aria-hidden style={{ height: virtual.padBottom }}>
                <td colSpan={20} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
