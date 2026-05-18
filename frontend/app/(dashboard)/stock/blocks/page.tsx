"use client";

import { WarehouseBlocksWorkspace } from "@/components/stock/warehouse-blocks-workspace";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";

export default function StockWarehouseBlocksPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const canWrite = isAdminOrOperatorLikeRole(role) || role === "skladchik";

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return <WarehouseBlocksWorkspace tenantSlug={tenantSlug} canWrite={canWrite} />;
}
