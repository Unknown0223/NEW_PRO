"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuthStore, useEffectiveRole } from "@/lib/auth-store";
import {
  ME_PERMISSIONS_REFETCH_INTERVAL_MS,
  ME_PERMISSIONS_STALE_MS,
  isMePermissionsBroadcastFromThisTab,
  isMePermissionsInitialLoad,
  mePermissionKeySet,
  mePermissionsQueryKey,
  normalizeMePermissionKeys,
  type MePermissionsBroadcast
} from "@/lib/me-permissions";

/**
 * Joriy foydalanuvchining ruxsat kalitlari (`/access/me-permissions`).
 * App-shell / useAccessModuleGate bilan bir xil query key — kesh ulashiladi.
 * `admin` rol barcha tekshiruvlardan o'tadi.
 *
 * Real-time: focus refetch + ~20s polling + BroadcastChannel / custom event.
 * Fon yangilanish `isLoading` ni true qilmaydi — sahifa/modal remount bo‘lmasin.
 */
export function usePermissions() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: mePermissionsQueryKey(tenantSlug),
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
    /** Fon refetch paytida eski kalitlar saqlansin (gate/workspace unmount bo‘lmasin). */
    placeholderData: (prev) => prev
  });

  useEffect(() => {
    if (!tenantSlug || typeof window === "undefined") return;

    const refresh = () => {
      void qc.invalidateQueries({
        queryKey: mePermissionsQueryKey(tenantSlug),
        refetchType: "active"
      });
    };

    const onCustom = () => refresh();
    window.addEventListener("salec:me-permissions-refresh", onCustom);

    let ch: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        ch = new BroadcastChannel("salec:me-permissions");
        ch.onmessage = (ev: MessageEvent<MePermissionsBroadcast>) => {
          const msg = ev.data;
          if (!msg || msg.type !== "invalidate") return;
          if (isMePermissionsBroadcastFromThisTab(msg)) return;
          if (msg.tenantSlug && msg.tenantSlug !== tenantSlug) return;
          refresh();
        };
      }
    } catch {
      ch = null;
    }

    return () => {
      window.removeEventListener("salec:me-permissions-refresh", onCustom);
      ch?.close();
    };
  }, [qc, tenantSlug]);

  const keys = useMemo(() => mePermissionKeySet(q.data), [q.data]);
  const isAdmin = role === "admin";
  const isLoading = isMePermissionsInitialLoad(q);

  return useMemo(
    () => ({
      isLoading,
      isAdmin,
      keys,
      has: (key: string) => isAdmin || keys.has(key),
      hasAny: (...list: string[]) => isAdmin || list.some((k) => keys.has(k)),
      hasAll: (...list: string[]) => isAdmin || list.every((k) => keys.has(k))
    }),
    [isLoading, isAdmin, keys]
  );
}
