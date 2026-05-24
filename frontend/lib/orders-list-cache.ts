import type { QueryClient } from "@tanstack/react-query";
import type { OrderDetailRow, OrderListRow } from "@/components/orders/order-detail-view";

export type OrdersListCacheBody = {
  data: OrderListRow[];
  total: number;
  page: number;
  limit: number;
};

/** Barcha `["orders", tenantSlug, …]` ro‘yxat cache larida bitta zakazni yangilash. */
export function patchOrderInOrdersListCaches(
  qc: QueryClient,
  tenantSlug: string | null | undefined,
  orderId: number,
  patch: (row: OrderListRow) => OrderListRow
): void {
  if (!tenantSlug) return;
  qc.setQueriesData<OrdersListCacheBody>({ queryKey: ["orders", tenantSlug] }, (old) => {
    if (!old?.data?.length) return old;
    let hit = false;
    const data = old.data.map((r) => {
      if (r.id !== orderId) return r;
      hit = true;
      return patch(r);
    });
    if (!hit) return old;
    return { ...old, data };
  });
}

export function applyOrderDetailToListCaches(
  qc: QueryClient,
  tenantSlug: string | null | undefined,
  detail: OrderDetailRow
): void {
  patchOrderInOrdersListCaches(qc, tenantSlug, detail.id, (r) => ({
    ...r,
    status: detail.status,
    allowed_next_statuses: detail.allowed_next_statuses,
    shipped_at: detail.shipped_at ?? r.shipped_at,
    delivered_at: detail.delivered_at ?? r.delivered_at,
    expected_ship_date: detail.expected_ship_date ?? r.expected_ship_date
  }));
}
