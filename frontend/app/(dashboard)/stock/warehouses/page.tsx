"use client";

import { WarehousesWorkspace } from "@/components/warehouses/warehouses-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

export default function StockWarehousesPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { has, isLoading } = usePermissions();
  const canCreate = has("warehouse.sklady.create");
  const canUpdate = has("warehouse.sklady.update");
  const canDelete = has("warehouse.sklady.delete");
  const canExport = has("warehouse.sklady.history") || has("warehouse.sklady.copy");

  if (!hydrated || isLoading || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <WarehousesWorkspace
      tenantSlug={tenantSlug}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canExport={canExport}
    />
  );
}
