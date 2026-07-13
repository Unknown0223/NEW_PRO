"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import {
  dataTableStickyActionsTdSingle,
  TableRowActionGroup
} from "@/components/data-table/table-row-actions";
import { buttonVariants } from "@/components/ui/button-variants";
import { OrderPromoAlertIcon } from "@/components/orders/discount-alert-icon";
import { useOrderListCellRenderer } from "@/components/orders/orders-list/order-list-table-cell";
import { OrdersListExpandedRow } from "@/components/orders/orders-list/orders-list-expanded-row";
import { orderListColumnTdClass } from "@/lib/orders-list-columns";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Copy, Eye, Globe, Smartphone } from "lucide-react";
import Link from "next/link";
import { Fragment, memo, useState } from "react";

export type OrdersListTableRowProps = {
  order: OrderListRow;
  tenantSlug: string;
  visibleColumnOrder: string[];
  selected: boolean;
  expanded: boolean;
  onToggleExpand: (id: number) => void;
  onToggleSelect: (id: number) => void;
  effectiveRole: string | null | undefined;
  statusRowError: Record<number, string>;
  rowStatusPendingId: number | null;
  onStatusChange: (id: number, status: string) => void;
  onChangeShipDate?: (id: number) => void;
  onPrefetchDetail: (id: number) => void;
  /** Scroll konteyner kengligi — expand panel sticky layout (orders-list-expand-layout.ts). */
  expandPanelWidth: number | null;
};

export const OrdersListTableRow = memo(function OrdersListTableRow({
  order,
  tenantSlug,
  visibleColumnOrder,
  selected,
  expanded,
  onToggleExpand,
  onToggleSelect,
  effectiveRole,
  statusRowError,
  rowStatusPendingId,
  onStatusChange,
  onChangeShipDate,
  onPrefetchDetail,
  expandPanelWidth
}: OrdersListTableRowProps) {
  const [hover, setHover] = useState(false);
  const renderCell = useOrderListCellRenderer({
    tenantSlug,
    effectiveRole,
    statusRowError,
    rowStatusPendingId,
    onStatusChange,
    onChangeShipDate
  });

  const channel = order.creation_channel ?? "web";
  const colSpan = visibleColumnOrder.length + 2;

  return (
    <Fragment>
      <tr
        className={cn(
          "cursor-pointer transition-colors",
          expanded
            ? "border-b-0 bg-[#e0f7f6] dark:bg-teal-950/35"
            : "border-b border-border/60 last:border-0",
          !expanded &&
            (selected
              ? "bg-[#e0f7f6] dark:bg-teal-950/35"
              : hover
                ? "bg-[#f0fdfc] dark:bg-teal-950/20"
                : "hover:bg-muted/30")
        )}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onToggleExpand(order.id)}
      >
        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-teal-600"
            checked={selected}
            onChange={() => onToggleSelect(order.id)}
            aria-label={`Заказ ${order.number}`}
          />
        </td>
        {visibleColumnOrder.map((colId) => {
          const right =
            colId === "qty" ||
            colId === "volume_m3" ||
            colId === "total_sum" ||
            colId === "bonus_sum" ||
            colId === "cumulative_bonus" ||
            colId === "discount_sum" ||
            colId === "balance" ||
            colId === "debt" ||
            colId === "client_id";
          return (
            <td
              key={colId}
              className={cn(
                "px-2 py-2.5 text-xs",
                orderListColumnTdClass(colId),
                right && "text-right tabular-nums",
                colId === "number" && "font-mono"
              )}
              onClick={colId === "status" ? (e) => e.stopPropagation() : undefined}
            >
              {colId === "number" ? (
                <div className="flex items-center gap-1.5">
                  <span
                    className="shrink-0 text-muted-foreground"
                    title={channel === "web" ? "Создан с веба" : "Создан с телефона"}
                  >
                    {channel === "web" ? (
                      <Globe className="size-3.5" aria-hidden />
                    ) : (
                      <Smartphone className="size-3.5" aria-hidden />
                    )}
                  </span>
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {order.number}
                  </Link>
                  <OrderPromoAlertIcon
                    discountAlert={order.discount_alert}
                    bonusAlert={order.bonus_alert}
                    size={15}
                  />
                  <button
                    type="button"
                    className="rounded p-0.5 text-teal-600 opacity-60 hover:bg-teal-100 hover:opacity-100"
                    title="Копировать номер"
                    aria-label="Копировать"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard?.writeText(order.number);
                    }}
                  >
                    <Copy className="size-3 shrink-0" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-teal-100 hover:text-teal-700"
                    title={expanded ? "Свернуть" : "Развернуть товары"}
                    aria-expanded={expanded}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(order.id);
                      onPrefetchDetail(order.id);
                    }}
                  >
                    {expanded ? (
                      <ChevronUp className="size-4" aria-hidden />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              ) : (
                renderCell(colId, order)
              )}
            </td>
          );
        })}
        <td className={dataTableStickyActionsTdSingle} onClick={(e) => e.stopPropagation()}>
          <TableRowActionGroup className="justify-end" ariaLabel="Заказ">
            <Link
              href={`/orders/${order.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "text-primary hover:bg-primary/10 hover:text-primary"
              )}
              prefetch={false}
              title="Детали"
              aria-label="Детали"
              onMouseEnter={() => onPrefetchDetail(order.id)}
            >
              <Eye className="size-3.5" aria-hidden />
            </Link>
          </TableRowActionGroup>
        </td>
      </tr>
      {expanded ? (
        <OrdersListExpandedRow
          tenantSlug={tenantSlug}
          orderId={order.id}
          orderNumber={order.number}
          colSpan={colSpan}
          panelWidth={expandPanelWidth}
        />
      ) : null}
    </Fragment>
  );
});
