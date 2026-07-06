"use client";

import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { AuditorsWorkspace } from "@/components/staff/auditors-workspace";

export default function AuditorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return <AuditorsWorkspace tenantSlug={tenantSlug} />;
}
