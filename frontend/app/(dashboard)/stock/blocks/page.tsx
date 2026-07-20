"use client";

import { WarehouseBlocksWorkspace } from "@/components/stock/warehouse-blocks-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

export default function StockWarehouseBlocksPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { has, isLoading } = usePermissions();
  const canWrite =
    has("warehouse.bloki.create") || has("warehouse.bloki.update") || has("warehouse.bloki.delete");

  if (!hydrated || isLoading || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return <WarehouseBlocksWorkspace tenantSlug={tenantSlug} canWrite={canWrite} />;
}
