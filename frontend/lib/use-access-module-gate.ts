"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** «Доступ» va tegishli sahifalar: `admin` yoki `access.manage`. */
export function useAccessModuleGate(tenantSlug: string | null | undefined, effectiveRole: string | null) {
  const q = useQuery({
    queryKey: ["me", "access-permissions", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: { keys: string[] } }>(`/api/${tenantSlug}/access/me-permissions`);
      return new Set(data.data?.keys ?? []);
    }
  });
  const keys =
    q.data instanceof Set ? q.data : new Set(Array.isArray(q.data) ? q.data : []);
  const allowed = effectiveRole === "admin" || keys.has("access.manage");
  return { allowed, isLoading: q.isLoading };
}
