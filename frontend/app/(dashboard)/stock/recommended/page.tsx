"use client";

import { StockRecommendedWorkspace } from "@/components/stock/stock-recommended-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function StockRecommendedPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return <StockRecommendedWorkspace tenantSlug={tenantSlug} />;
}
