"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore, useEffectiveRole } from "@/lib/auth-store";

/**
 * Joriy foydalanuvchining ruxsat kalitlari (`/access/me-permissions`).
 * App-shell / useAccessModuleGate bilan bir xil query key — kesh ulashiladi.
 * `admin` rol barcha tekshiruvlardan o'tadi.
 */
export function usePermissions() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const q = useQuery({
    queryKey: ["me", "access-permissions", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: { keys: string[] } }>(
        `/api/${tenantSlug}/access/me-permissions`
      );
      return new Set(data.data?.keys ?? []);
    }
  });
  const keys = q.data instanceof Set ? q.data : new Set<string>();
  const isAdmin = role === "admin";
  return {
    isLoading: q.isLoading,
    isAdmin,
    keys,
    has: (key: string) => isAdmin || keys.has(key),
    hasAny: (...list: string[]) => isAdmin || list.some((k) => keys.has(k)),
    hasAll: (...list: string[]) => isAdmin || list.every((k) => keys.has(k))
  };
}
