"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { OrdersProductsByCategoryView } from "@/components/orders/orders-list/orders-products-by-category-view";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";

function OrdersListExpandedBody({
  tenantSlug,
  orderId,
  orderNumber
}: {
  tenantSlug: string;
  orderId: number;
  orderNumber?: string;
}) {
  const q = useQuery({
    queryKey: ["order", tenantSlug, orderId],
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`);
      return data;
    }
  });

  const items = q.data?.items ?? [];
  return (
    <div
      role="region"
      aria-label={orderNumber ? `Товары заказа ${orderNumber}` : "Товары заказа"}
    >
      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Загрузка товаров…</p>
      ) : q.isError ? (
        <p className="text-xs text-destructive">Не удалось загрузить строки</p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Package className="size-4 shrink-0" aria-hidden />
          Нет строк товаров
        </p>
      ) : (
        <OrdersProductsByCategoryView items={items} />
      )}
    </div>
  );
}

/**
 * Mahsulot bloki — zakaz qatori tagida, gorizontal scrolldan mustaqil (sticky + viewport kengligi).
 */
export function OrdersListExpandedRow({
  tenantSlug,
  orderId,
  orderNumber,
  colSpan,
  viewportWidth
}: {
  tenantSlug: string;
  orderId: number;
  orderNumber?: string;
  colSpan: number;
  viewportWidth: number;
}) {
  const panelWidth = viewportWidth > 0 ? viewportWidth : undefined;

  return (
    <tr className="border-b border-gray-200 bg-transparent" onClick={(e) => e.stopPropagation()}>
      <td colSpan={colSpan} className="bg-transparent p-0 align-top">
        <div className="animate-orders-expand py-2 pl-1 sm:pl-2">
          <div
            className="sticky left-0 z-[5] box-border rounded-lg bg-[#f0fdfc] px-4 py-4 sm:px-5 dark:bg-teal-950/25"
            style={{
              width: panelWidth,
              maxWidth: panelWidth
            }}
          >
            <OrdersListExpandedBody
              tenantSlug={tenantSlug}
              orderId={orderId}
              orderNumber={orderNumber}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

/** Jadvaldan tashqarida (to‘liq kenglik) */
export function OrdersListExpandedPanel(props: {
  tenantSlug: string;
  orderId: number;
  orderNumber?: string;
}) {
  return (
    <div
      className="animate-orders-expand border-t border-border bg-[#f0fdfc] px-4 py-4 sm:px-6 dark:bg-teal-950/25"
      onClick={(e) => e.stopPropagation()}
    >
      <OrdersListExpandedBody {...props} />
    </div>
  );
}
