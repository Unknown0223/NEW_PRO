"use client";

import { OrdersConsignmentTransfersWorkspace } from "@/components/settings/orders-consignment-transfers-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function OrdersConsignmentPeriodPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return <OrdersConsignmentTransfersWorkspace tenantSlug={tenantSlug} />;
}
