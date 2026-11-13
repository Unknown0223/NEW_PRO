"use client";

import { ErrorLogsWorkspace } from "@/components/diagnostics/error-logs-workspace";
import { AccessDeniedBanner } from "@/components/access/access-denied-banner";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";

export default function DiagnosticsErrorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }
  if (role !== "admin") {
    return (
      <AccessDeniedBanner
        resource="Диагностика · Ошибки"
        message="Раздел доступен только администратору."
      />
    );
  }
  return <ErrorLogsWorkspace tenantSlug={tenantSlug} />;
}
