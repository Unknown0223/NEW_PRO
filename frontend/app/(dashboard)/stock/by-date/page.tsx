"use client";

import { StockByDateWorkspace } from "@/components/stock/stock-by-date-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function StockByDatePage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return <StockByDateWorkspace tenantSlug={tenantSlug} />;
}

