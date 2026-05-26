"use client";

import { OrderDetailView, type OrderDetailRow } from "@/components/orders/order-detail-view";
import { OrderDetailBreadcrumbs } from "@/components/orders/order-detail/order-detail-breadcrumbs";
import { OrderDetailHeader } from "@/components/orders/order-detail/order-detail-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function OrderDetailPage() {
  const params = useParams();
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const orderId = Number.parseInt(idStr ?? "", 10);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const invalid = !Number.isFinite(orderId) || orderId < 1;

  const orderTitleQ = useQuery({
    queryKey: ["order", tenantSlug, orderId],
    enabled: Boolean(tenantSlug) && !invalid,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`);
      return data;
    }
  });

  const titleNumber =
    orderTitleQ.data?.number ??
    (orderTitleQ.isLoading ? "…" : invalid ? "—" : String(orderId));

  return (
    <PageShell className="pb-8">
      {!invalid ? (
        <>
          <OrderDetailBreadcrumbs orderNumber={titleNumber} />
          <OrderDetailHeader orderNumber={titleNumber} orderId={orderId} />
        </>
      ) : null}

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия истекла — войдите снова.</p>
      ) : invalid ? (
        <p className="text-sm text-destructive">Неверный идентификатор заявки.</p>
      ) : (
        <OrderDetailView tenantSlug={tenantSlug} orderId={orderId} />
      )}
    </PageShell>
  );
}
