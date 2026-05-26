"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { OrderStatusDropdown } from "@/components/orders/orders-list/order-status-dropdown";
import { CheckCircle } from "lucide-react";

export function OrderDetailStatusSection({
  data,
  tenantSlug,
  effectiveRole,
  statusPending,
  statusError,
  onStatusChange
}: {
  data: OrderDetailRow;
  tenantSlug: string;
  effectiveRole: string | null | undefined;
  statusPending: boolean;
  statusError?: string;
  onStatusChange: (id: number, status: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">Заказ</span>
        </div>
        <OrderStatusDropdown
          tenantSlug={tenantSlug}
          order={data}
          effectiveRole={effectiveRole}
          isPending={statusPending}
          statusError={statusError}
          onStatusChange={onStatusChange}
        />
      </div>
      {statusError ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {statusError}
        </p>
      ) : null}
    </div>
  );
}
