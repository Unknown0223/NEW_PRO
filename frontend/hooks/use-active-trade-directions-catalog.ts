"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { tradeDirectionFilterLabels, type TradeDirectionCatalogRow } from "@/lib/catalog-filter-options";

export function useActiveTradeDirectionsCatalog(tenantSlug: string | null | undefined, scopeKey = "default") {
  const q = useQuery({
    queryKey: ["trade-directions", tenantSlug, "catalog-active", scopeKey],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: TradeDirectionCatalogRow[] }>(
        `/api/${tenantSlug}/trade-directions?is_active=true`
      );
      return data.data ?? [];
    }
  });
  const labels = tradeDirectionFilterLabels(q.data);
  return { ...q, rows: q.data ?? [], labels };
}
