"use client";

import { fetchDashboardMeta } from "@/lib/use-dashboard-meta";
import { qkDashboardMeta } from "@/lib/dashboard-shared-query-keys";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Dashboard bo‘limida meta keshini oldindan to‘ldiradi. */
export function DashboardMetaPrefetch() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();

  useEffect(() => {
    if (!tenantSlug || !hydrated) return;
    void qc.prefetchQuery({
      queryKey: qkDashboardMeta(tenantSlug),
      queryFn: () => fetchDashboardMeta(tenantSlug),
      staleTime: STALE.reference
    });
  }, [tenantSlug, hydrated, qc]);

  return null;
}
