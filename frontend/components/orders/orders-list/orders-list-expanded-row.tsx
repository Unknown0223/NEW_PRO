"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { ORDERS_LIST_EXPANDED_PANEL_CLASS } from "@/components/orders/orders-list/orders-list-expand-layout";
import { OrdersProductsByCategoryView } from "@/components/orders/orders-list/orders-products-by-category-view";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import type { CSSProperties } from "react";

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
      className="min-w-0 max-w-full"
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
        <OrdersProductsByCategoryView items={items} discount_sum={q.data?.discount_sum} />
      )}
    </div>
  );
}

function expandedPanelStyle(panelWidth: number | null | undefined): CSSProperties | undefined {
  if (panelWidth == null || panelWidth <= 0) return undefined;
  return { width: panelWidth, maxWidth: panelWidth };
}

/**
 * CURSOR / AI AGENT — DO NOT MODIFY expand layout without explicit user request.
 *
 * Mahsulot bloki zakaz qatori tagida ochiladi. Gorizontal scrollsiz:
 * - `panelWidth` = scroll konteyner clientWidth (orders-list-table.tsx)
 * - `orders-list-expanded-panel` = sticky left:0 (globals.css)
 * - `w-full` ishlatilmaydi — 3200px jadval kengligiga cho‘ziladi.
 *
 * Sabab: min-w-[3200px] jadval + colSpan → panel butun jadvalga cho‘zilardi.
 */
export function OrdersListExpandedRow({
  tenantSlug,
  orderId,
  orderNumber,
  colSpan,
  panelWidth
}: {
  tenantSlug: string;
  orderId: number;
  orderNumber?: string;
  colSpan: number;
  panelWidth?: number | null;
}) {
  return (
    <tr className="border-b border-border bg-transparent" onClick={(e) => e.stopPropagation()}>
      <td colSpan={colSpan} className="bg-transparent p-0 align-top">
        <div
          className={`${ORDERS_LIST_EXPANDED_PANEL_CLASS} animate-orders-expand border-y border-teal-100/90 bg-[#f0fdfc] px-4 py-4 sm:px-5 dark:border-teal-900/50 dark:bg-teal-950/25`}
          style={expandedPanelStyle(panelWidth)}
        >
          <OrdersListExpandedBody
            tenantSlug={tenantSlug}
            orderId={orderId}
            orderNumber={orderNumber}
          />
        </div>
      </td>
    </tr>
  );
}

/** Jadvaldan tashqarida (to‘liq kenglik) — boshqa kontekstlar uchun */
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
