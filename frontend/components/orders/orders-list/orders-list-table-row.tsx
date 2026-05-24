"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import {
  dataTableStickyActionsTdSingle,
  TableRowActionGroup
} from "@/components/data-table/table-row-actions";
import { buttonVariants } from "@/components/ui/button-variants";
import { useOrderListCellRenderer } from "@/components/orders/orders-list/order-list-table-cell";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

export type OrdersListTableRowProps = {
  order: OrderListRow;
  visibleColumnOrder: string[];
  selected: boolean;
  onToggleSelect: (id: number) => void;
  effectiveRole: string | null | undefined;
  statusRowError: Record<number, string>;
  rowStatusPendingId: number | null;
  onStatusChange: (id: number, status: string) => void;
  onPrefetchDetail: (id: number) => void;
};

export const OrdersListTableRow = memo(function OrdersListTableRow({
  order,
  visibleColumnOrder,
  selected,
  onToggleSelect,
  effectiveRole,
  statusRowError,
  rowStatusPendingId,
  onStatusChange,
  onPrefetchDetail
}: OrdersListTableRowProps) {
  const renderCell = useOrderListCellRenderer({
    effectiveRole,
    statusRowError,
    rowStatusPendingId,
    onStatusChange
  });

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={selected}
          onChange={() => onToggleSelect(order.id)}
          aria-label={`Zakaz ${order.number} ni tanlash`}
        />
      </td>
      {visibleColumnOrder.map((colId) => {
        const right =
          colId === "qty" ||
          colId === "total_sum" ||
          colId === "discount_sum" ||
          colId === "bonus_qty" ||
          colId === "balance" ||
          colId === "debt";
        return (
          <td
            key={colId}
            className={cn(
              "px-3 py-2",
              right && "text-right tabular-nums",
              colId === "number" && "font-mono text-xs",
              (colId === "created_at" || colId === "discount_sum" || colId === "bonus_qty") &&
                "text-xs text-muted-foreground"
            )}
          >
            {renderCell(colId, order)}
          </td>
        );
      })}
      <td className={dataTableStickyActionsTdSingle}>
        <TableRowActionGroup className="justify-end" ariaLabel="Zakaz">
          <Link
            href={`/orders/${order.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "text-primary hover:bg-primary/10 hover:text-primary"
            )}
            prefetch={false}
            title="Tafsilot"
            aria-label="Tafsilot"
            onMouseEnter={() => onPrefetchDetail(order.id)}
          >
            <Eye className="size-3.5" aria-hidden />
          </Link>
        </TableRowActionGroup>
      </td>
    </tr>
  );
});
