"use client";

import { MaterialReportWorkspace } from "@/components/stock/material-report-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function StockMaterialReportPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return <MaterialReportWorkspace tenantSlug={tenantSlug} />;
}
