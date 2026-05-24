"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import { OrderStatusCell } from "@/components/orders/orders-list/order-status-cell";
import { formatOrderListDebtAsClientLiability } from "@/lib/orders-list-columns";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { orderTypeColor, orderTypeLabel } from "@/lib/order-types";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { parseNumField } from "./types";

export type RenderOrderListCellArgs = {
  colId: string;
  order: OrderListRow;
  effectiveRole: string | null | undefined;
  statusRowError: Record<number, string>;
  rowStatusPendingId: number | null;
  onStatusChange: (id: number, status: string) => void;
};

export function renderOrderListCell({
  colId,
  order,
  effectiveRole,
  statusRowError,
  rowStatusPendingId,
  onStatusChange
}: RenderOrderListCellArgs): ReactNode {
  switch (colId) {
    case "number":
      return (
        <div className="flex items-center gap-1">
          <Link
            href={`/orders/${order.id}`}
            className="font-mono text-xs text-primary underline-offset-2 hover:underline"
          >
            {order.number}
          </Link>
          <button
            type="button"
            className="inline-flex rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Raqamni nusxalash"
            aria-label="Nusxa"
            onClick={() => void navigator.clipboard?.writeText(order.number)}
          >
            <Copy className="size-3.5 shrink-0" aria-hidden />
          </button>
        </div>
      );
    case "order_type": {
      const color = orderTypeColor(order.order_type);
      return (
        <span className={`rounded-md px-2 py-0.5 text-xs ${color}`}>
          {orderTypeLabel(order.order_type)}
        </span>
      );
    }
    case "created_at":
      return (
        <span className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleString()}
        </span>
      );
    case "expected_ship_date":
      return order.expected_ship_date ? new Date(order.expected_ship_date).toLocaleDateString() : "—";
    case "shipped_at":
      return order.shipped_at ? new Date(order.shipped_at).toLocaleDateString() : "—";
    case "delivered_at":
      return order.delivered_at ? new Date(order.delivered_at).toLocaleDateString() : "—";
    case "status":
      return (
        <OrderStatusCell
          order={order}
          effectiveRole={effectiveRole}
          statusError={statusRowError[order.id]}
          isPending={rowStatusPendingId === order.id}
          onStatusChange={onStatusChange}
        />
      );
    case "client_name":
      return (
        <Link
          href={`/clients/${order.client_id}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {order.client_name}
        </Link>
      );
    case "client_legal_name":
      return order.client_legal_name ?? "—";
    case "client_id":
      return (
        <Link
          href={`/clients/${order.client_id}`}
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          #{order.client_id}
        </Link>
      );
    case "qty":
      return (
        <span className="tabular-nums">
          {formatNumberGrouped(order.qty, { maxFractionDigits: 3 })}
        </span>
      );
    case "total_sum":
      return (
        <span className="tabular-nums">
          {formatNumberGrouped(order.total_sum, { maxFractionDigits: 2 })}
        </span>
      );
    case "discount_sum": {
      const n = parseNumField(order.discount_sum ?? "0");
      return (
        <span className="tabular-nums text-xs text-amber-900 dark:text-amber-200">
          {n > 0 ? formatNumberGrouped(n, { maxFractionDigits: 0 }) : "—"}
        </span>
      );
    }
    case "bonus_qty": {
      const n = parseNumField(order.bonus_qty ?? "0");
      return (
        <span className="tabular-nums text-xs text-emerald-800 dark:text-emerald-300">
          {n > 0 ? formatNumberGrouped(n, { maxFractionDigits: 3 }) : "—"}
        </span>
      );
    }
    case "balance": {
      if (order.balance == null) return "—";
      const b = parseNumField(order.balance);
      return (
        <span className={cn("tabular-nums", b < 0 && "font-medium text-destructive")}>
          {formatNumberGrouped(order.balance, { maxFractionDigits: 2 })}
        </span>
      );
    }
    case "debt": {
      const debtTxt = formatOrderListDebtAsClientLiability(order.debt);
      return debtTxt ? (
        <span className="tabular-nums font-medium text-destructive">{debtTxt}</span>
      ) : (
        "—"
      );
    }
    case "price_type":
      return order.price_type ?? "—";
    case "warehouse_name":
      return order.warehouse_name ?? "—";
    case "warehouse_block_name":
      return order.warehouse_block_name?.trim() ? order.warehouse_block_name : "—";
    case "agent_name":
      return order.agent_name ?? "—";
    case "agent_code":
      return order.agent_code ?? "—";
    case "expeditors":
      return order.expeditor_display ?? order.expeditors ?? "—";
    case "region":
      return order.region ?? "—";
    case "city":
      return order.city ?? "—";
    case "zone":
      return order.zone ?? "—";
    case "consignment":
      return order.consignment == null ? "—" : order.consignment ? "Ha" : "Yo‘q";
    case "day":
      return order.day ?? "—";
    case "created_by":
      return order.created_by ?? "—";
    case "comment":
      return order.comment ?? "—";
    case "created_by_role":
      return order.created_by_role ?? "—";
    default:
      return "—";
  }
}

export function useOrderListCellRenderer(args: Omit<RenderOrderListCellArgs, "colId" | "order">) {
  return useCallback(
    (colId: string, order: OrderListRow) =>
      renderOrderListCell({ colId, order, ...args }),
    [args.effectiveRole, args.onStatusChange, args.rowStatusPendingId, args.statusRowError]
  );
}
