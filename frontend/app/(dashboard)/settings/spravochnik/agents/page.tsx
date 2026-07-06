"use client";

import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { AgentsWorkspace } from "@/components/staff/agents-workspace";

export default function AgentsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return (
    <AgentsWorkspace tenantSlug={tenantSlug} />
  );
}
