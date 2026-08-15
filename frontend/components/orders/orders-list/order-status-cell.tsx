"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VALUES } from "@/lib/order-status";
import { usePermissions } from "@/lib/use-permissions";
import { memo } from "react";

export type OrderStatusCellProps = {
  order: OrderListRow;
  effectiveRole: string | null | undefined;
  statusError?: string;
  isPending: boolean;
  onStatusChange: (id: number, status: string) => void;
};

export const OrderStatusCell = memo(function OrderStatusCell({
  order,
  statusError,
  isPending,
  onStatusChange
}: OrderStatusCellProps) {
  const { has } = usePermissions();
  const canPatch = has("orders.zakaz.status") || has("orders.status.status");
  const allowedRaw = order.allowed_next_statuses ?? [];
  const nextOnly = new Set(allowedRaw.filter((s) => s !== order.status));
  const nextStatuses = ORDER_STATUS_VALUES.filter((v) => nextOnly.has(v));
  const err = statusError;

  if (!canPatch || nextStatuses.length === 0) {
    return (
      <span className="inline-flex flex-col gap-0.5 align-top">
        <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-xs">
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </span>
        {err ? <span className="max-w-[12rem] text-[10px] text-destructive">{err}</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5 align-top">
      <select
        className="h-8 min-w-[9rem] max-w-[14rem] rounded-md border border-input bg-background px-1.5 text-xs"
        value={order.status}
        disabled={isPending}
        onChange={(e) => {
          const v = e.target.value;
          if (v === order.status) return;
          onStatusChange(order.id, v);
        }}
        aria-label="Zakaz holati"
      >
        <option value={order.status} disabled hidden>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </option>
        {nextStatuses.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s] ?? s}
          </option>
        ))}
      </select>
      {err ? <span className="max-w-[12rem] text-[10px] text-destructive">{err}</span> : null}
    </span>
  );
});
