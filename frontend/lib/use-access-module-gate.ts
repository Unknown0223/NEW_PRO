"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  ME_PERMISSIONS_REFETCH_INTERVAL_MS,
  ME_PERMISSIONS_STALE_MS,
  decodeAccessTokenUserId,
  isMePermissionsInitialLoad,
  mePermissionKeySet,
  mePermissionsQueryKey,
  normalizeMePermissionKeys
} from "@/lib/me-permissions";

/** «Доступ» va tegishli sahifalar: `admin` yoki `access.upravlenie.view`. */
export function useAccessModuleGate(tenantSlug: string | null | undefined, effectiveRole: string | null) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = decodeAccessTokenUserId(accessToken);
  const q = useQuery({
    queryKey: mePermissionsQueryKey(tenantSlug, userId),
    enabled: Boolean(tenantSlug),
    staleTime: ME_PERMISSIONS_STALE_MS,
    refetchOnWindowFocus: true,
    refetchInterval: tenantSlug ? ME_PERMISSIONS_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await api.get<{ data: { keys: string[] } }>(
        `/api/${tenantSlug}/access/me-permissions`
      );
      return normalizeMePermissionKeys(data.data?.keys ?? []);
    },
    placeholderData: (prev) => prev
  });
  const keys = mePermissionKeySet(q.data);
  const allowed = effectiveRole === "admin" || keys.has("access.upravlenie.view");
  return {
    allowed,
    /** Faqat birinchi yuklash — poll/focus Access workspace ni yopmasin. */
    isLoading: isMePermissionsInitialLoad(q)
  };
}
