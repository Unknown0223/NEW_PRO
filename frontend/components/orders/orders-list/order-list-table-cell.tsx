"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import { OrderStatusDropdown } from "@/components/orders/orders-list/order-status-dropdown";
import { formatOrderListDateTime } from "@/lib/format-order-list-datetime";
import {
  formatOrderListDebtAsClientLiability,
  orderListExportCell
} from "@/lib/orders-list-columns";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { orderTypeLabel } from "@/lib/order-types";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { parseNumField } from "./types";

async function copyText(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    /* ignore */
  }
}

/** Havola yonida — matn boshqa sahifaga, nusxa faqat ikonka orqali. */
function CopyBtn({ text, title }: { text: string; title: string }) {
  return (
    <button
      type="button"
      className="inline-flex rounded p-0.5 text-teal-600 opacity-60 transition-opacity hover:bg-teal-100 hover:opacity-100 dark:text-teal-400 dark:hover:bg-teal-950/50"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        void copyText(text);
      }}
    >
      <Copy className="size-3 shrink-0" aria-hidden />
    </button>
  );
}

/** Oddiy matn — bosganda nusxa (ikonkasiz). */
function CopyableText({
  text,
  title = "Копировать",
  className
}: {
  text: string;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline cursor-copy border-0 bg-transparent p-0 text-inherit transition-colors",
        "hover:text-teal-700 dark:hover:text-teal-400",
        className
      )}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        void copyText(text);
      }}
    >
      {text}
    </button>
  );
}

export type RenderOrderListCellArgs = {
  colId: string;
  order: OrderListRow;
  tenantSlug: string | null;
  effectiveRole: string | null | undefined;
  statusRowError: Record<number, string>;
  rowStatusPendingId: number | null;
  onStatusChange: (id: number, status: string) => void;
  onChangeShipDate?: (id: number) => void;
};

export function renderOrderListCell({
  colId,
  order,
  tenantSlug,
  effectiveRole,
  statusRowError,
  rowStatusPendingId,
  onStatusChange,
  onChangeShipDate
}: RenderOrderListCellArgs): ReactNode {
  switch (colId) {
    case "number":
      return null;
    case "source_order_number": {
      const nums = order.source_order_numbers ?? [];
      const ids = order.source_order_ids ?? [];
      if (nums.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-col gap-0.5">
          {nums.map((num, i) => {
            const oid = ids[i];
            return (
              <div key={`${num}-${i}`} className="flex items-center gap-1">
                {oid != null ? (
                  <Link
                    href={`/orders/${oid}`}
                    className="text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {num}
                  </Link>
                ) : (
                  <CopyableText text={num} title="Копировать" className="text-foreground" />
                )}
                {oid != null ? <CopyBtn text={num} title="Копировать" /> : null}
              </div>
            );
          })}
        </div>
      );
    }
    case "request_source": {
      const src = orderListExportCell(order, "request_source");
      return src ? <span>{src}</span> : <span className="text-muted-foreground">—</span>;
    }
    case "order_type": {
      const t = order.order_type ?? "order";
      if (t === "return_by_order") {
        const src = order.source_order_numbers?.[0];
        return (
          <div className="text-[#7c2d12] leading-tight dark:text-orange-200">
            <div>Возврат с</div>
            <div>полки по</div>
            <div className="flex flex-wrap items-center gap-1">
              <span>заказу</span>
              {src ? (
                <span className="text-teal-700 dark:text-teal-400">
                  (
                  <CopyableText text={src} title="Копировать заказ" />
                  )
                </span>
              ) : null}
            </div>
          </div>
        );
      }
      if (t === "return") {
        return (
          <div className="text-[#7c2d12] leading-tight dark:text-orange-200">
            <div>Возврат с</div>
            <div>полки</div>
          </div>
        );
      }
      return <span className="text-foreground">{orderTypeLabel(t)}</span>;
    }
    case "created_at":
      return (
        <span className="whitespace-nowrap text-foreground">
          {formatOrderListDateTime(order.created_at) || "—"}
        </span>
      );
    case "list_created_at":
      return (
        <span className="whitespace-nowrap text-foreground">
          {formatOrderListDateTime(order.list_created_at ?? order.created_at) || "—"}
        </span>
      );
    case "expected_ship_date":
      return (
        <span className="whitespace-nowrap">
          {formatOrderListDateTime(order.expected_ship_date) || ""}
        </span>
      );
    case "shipped_at":
      return (
        <span className="whitespace-nowrap">
          {formatOrderListDateTime(order.shipped_at) || ""}
        </span>
      );
    case "delivered_at":
      return (
        <span className="whitespace-nowrap">
          {formatOrderListDateTime(order.delivered_at) || ""}
        </span>
      );
    case "returned_at":
      return (
        <span className="whitespace-nowrap">
          {formatOrderListDateTime(order.returned_at) || ""}
        </span>
      );
    case "status":
      return (
        <OrderStatusDropdown
          tenantSlug={tenantSlug}
          order={order}
          effectiveRole={effectiveRole}
          statusError={statusRowError[order.id]}
          isPending={rowStatusPendingId === order.id}
          onStatusChange={onStatusChange}
          onChangeShipDate={onChangeShipDate}
        />
      );
    case "client_name":
      return order.client_name?.trim() ? (
        <CopyableText
          text={order.client_name}
          title="Копировать клиента"
          className="font-medium"
        />
      ) : (
        "—"
      );
    case "client_legal_name":
      return order.client_legal_name?.trim() ? order.client_legal_name : "—";
    case "client_id":
      return (
        <div className="flex items-center gap-1">
          <Link
            href={`/clients/${order.client_id}`}
            className="font-mono text-xs text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            onClick={(e) => e.stopPropagation()}
          >
            #{order.client_id}
          </Link>
          <CopyBtn text={String(order.client_id)} title="Копировать ид клиента" />
        </div>
      );
    case "client_phone":
      return order.client_phone?.trim() ? (
        <CopyableText
          text={order.client_phone}
          title="Копировать телефон"
          className="whitespace-nowrap"
        />
      ) : (
        "—"
      );
    case "client_inn":
      return order.client_inn?.trim() ? (
        <span className="font-mono text-xs">{order.client_inn}</span>
      ) : (
        "—"
      );
    case "volume_m3":
      return order.volume_m3 ? (
        <span className="tabular-nums">
          {formatNumberGrouped(order.volume_m3, { maxFractionDigits: 4 })}
        </span>
      ) : (
        "—"
      );
    case "bonus_sum":
      return (
        <span className="tabular-nums text-emerald-800 dark:text-emerald-300">
          {formatNumberGrouped(order.bonus_sum ?? "0", { maxFractionDigits: 2 })}
        </span>
      );
    case "cumulative_bonus":
      return order.cumulative_bonus ? (
        <span className="tabular-nums">
          {formatNumberGrouped(order.cumulative_bonus, { maxFractionDigits: 2 })}
        </span>
      ) : (
        "—"
      );
    case "client_address":
      return order.client_address?.trim() ? (
        <span className="max-w-[14rem] truncate" title={order.client_address}>
          {order.client_address}
        </span>
      ) : (
        "—"
      );
    case "order_location":
      return order.order_location?.trim() ? (
        <span className="max-w-[12rem] truncate" title={order.order_location}>
          {order.order_location}
        </span>
      ) : (
        "—"
      );
    case "consignment_due_date":
      return (
        <span className="whitespace-nowrap">
          {formatOrderListDateTime(order.consignment_due_date) || "—"}
        </span>
      );
    case "is_consignment":
      return order.is_consignment ? (
        <span className="text-foreground">Да</span>
      ) : (
        <span className="text-muted-foreground">Нет</span>
      );
    case "sales_channel":
      return order.sales_channel?.trim() ?? "—";
    case "agent_trade_direction":
      return order.agent_trade_direction?.trim() ?? "—";
    case "request_type_ref":
      return order.request_type_ref?.trim() ?? "—";
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
        <span className="tabular-nums text-amber-900 dark:text-amber-200">
          {n > 0 ? formatNumberGrouped(n, { maxFractionDigits: 2 }) : "—"}
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
    [
      args.tenantSlug,
      args.effectiveRole,
      args.onChangeShipDate,
      args.onStatusChange,
      args.rowStatusPendingId,
      args.statusRowError
    ]
  );
}
