"use client";

import { QueryErrorState } from "@/components/common/query-error-state";
import {
  buildBonusHistorySection,
  buildOrderHistoryProducts,
  buildOrderVersions,
  orderHistoryAuditMeta
} from "@/components/orders/order-history/build-order-history-data";
import { OrderHistoryAuditSection } from "@/components/orders/order-history/order-history-audit-section";
import { OrderHistoryBonusTable } from "@/components/orders/order-history/order-history-bonus-table";
import { OrderHistoryInfoSection } from "@/components/orders/order-history/order-history-info-section";
import { OrderHistoryPageHeader } from "@/components/orders/order-history/order-history-page-header";
import { OrderHistorySkeleton } from "@/components/orders/order-history/order-history-skeleton";
import { HistoryTimeline } from "@/components/history/history-timeline";
import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { api } from "@/lib/api";
import { useEntityHistory } from "@/lib/use-entity-history";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type Props = {
  tenantSlug: string;
  orderId: number;
};

export function OrderHistoryView({ tenantSlug, orderId }: Props) {
  const q = useQuery({
    queryKey: ["order", tenantSlug, orderId],
    enabled: Boolean(tenantSlug) && orderId > 0,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data: body } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`);
      return body;
    }
  });

  const timeline = useEntityHistory({ tenantSlug, entityType: "order", entityId: orderId });

  const derived = useMemo(() => {
    if (!q.data) return null;
    const versions = buildOrderVersions(q.data);
    return {
      versions,
      products: buildOrderHistoryProducts(q.data),
      bonusSection: buildBonusHistorySection(q.data),
      audit: orderHistoryAuditMeta(versions, q.data)
    };
  }, [q.data]);

  if (!tenantSlug) {
    return <p className="text-sm text-destructive">Tenant aniqlanmadi.</p>;
  }

  if (q.isLoading) {
    return <OrderHistorySkeleton />;
  }

  if (q.isError || !q.data || !derived) {
    return (
      <QueryErrorState
        message={
          q.error
            ? getUserFacingError(q.error)
            : "Не удалось загрузить историю заказа"
        }
        onRetry={() => void q.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <OrderHistoryPageHeader orderId={orderId} backHref={`/orders/${orderId}`} />

      <div className="space-y-5">
        <OrderHistoryAuditSection
          createdBy={derived.audit.createdBy}
          updatedBy={derived.audit.updatedBy}
          lastChange={derived.audit.lastChange}
        />

        <OrderHistoryInfoSection versions={derived.versions} products={derived.products} />

        <OrderHistoryBonusTable section={derived.bonusSection} />

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Хронология действий</h2>
          {timeline.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка хронологии...</p>
          ) : (
            <HistoryTimeline items={timeline.data?.items ?? []} />
          )}
        </section>
      </div>
    </div>
  );
}
