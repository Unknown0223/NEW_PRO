"use client";

import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { CollectorsWorkspace } from "@/components/staff/collectors-workspace";

export default function CollectorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return <CollectorsWorkspace tenantSlug={tenantSlug} />;
}
