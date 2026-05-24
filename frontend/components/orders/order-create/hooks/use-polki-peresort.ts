"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";

type InterchangeableGroupDto = { products: Array<{ id: number; name: string }> };

export function usePolkiPeresort(tenantSlug: string | null, enabled: boolean) {
  const q = useQuery({
    queryKey: ["polki-interchangeable-groups", tenantSlug],
    enabled: Boolean(tenantSlug && enabled),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: InterchangeableGroupDto[] }>(
        `/api/${tenantSlug}/catalog/interchangeable-groups`,
        { params: { is_active: true, limit: 200, page: 1 } }
      );
      return data.data ?? [];
    }
  });

  const optionsByProductId = useMemo(() => {
    const map = new Map<number, Array<{ id: number; name: string }>>();
    for (const g of q.data ?? []) {
      for (const p of g.products) {
        const siblings = g.products.filter((x) => x.id !== p.id);
        if (siblings.length > 0) map.set(p.id, siblings);
      }
    }
    return map;
  }, [q.data]);

  return { polkiInterchangeableQ: q, polkiPeresortOptionsByProductId: optionsByProductId };
}
