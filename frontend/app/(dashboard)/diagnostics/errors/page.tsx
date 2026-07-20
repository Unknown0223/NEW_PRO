"use client";

import { ErrorLogsWorkspace } from "@/components/diagnostics/error-logs-workspace";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";

export default function DiagnosticsErrorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }
  if (role !== "admin") {
    return <p className="text-sm text-destructive">Bu bo&apos;lim faqat administrator uchun.</p>;
  }
  return <ErrorLogsWorkspace tenantSlug={tenantSlug} />;
}
