"use client";

import { StockReceiptsReportWorkspace } from "@/components/stock/stock-receipts-report-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function StockReceiptsReportDailyPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return <StockReceiptsReportWorkspace tenantSlug={tenantSlug} daily />;
}

