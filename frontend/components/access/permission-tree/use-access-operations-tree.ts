"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AccessTreeModule } from "@/lib/access-operations-tree";

export function useAccessOperationsTree(tenantSlug: string) {
  return useQuery({
    queryKey: ["access-operations-tree", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get<{ data: AccessTreeModule[] }>(`/api/${tenantSlug}/access/operations-tree`);
      return data.data ?? [];
    }
  });
}
