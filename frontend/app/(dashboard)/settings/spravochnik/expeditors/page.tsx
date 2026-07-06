"use client";

import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { ExpeditorsWorkspace } from "@/components/staff/expeditors-workspace";

export default function ExpeditorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return <ExpeditorsWorkspace tenantSlug={tenantSlug} />;
}
