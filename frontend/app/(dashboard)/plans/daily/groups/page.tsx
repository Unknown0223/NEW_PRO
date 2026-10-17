"use client";

import { Suspense } from "react";
import { DailyKpiWorkspace } from "@/components/plans/daily-kpi/daily-kpi-workspace";
import { NAV_PERM } from "@/components/dashboard/nav-permission-keys";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

function PageInner() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const perms = usePermissions();
  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка…</p>;
  if (!perms.isLoading && !NAV_PERM.dailyKpi.some((k) => perms.has(k))) {
    return <p className="p-6 text-sm text-muted-foreground">Нет доступа к этому разделу.</p>;
  }
  return (
    <div className="space-y-4 p-1">
      <DailyKpiWorkspace tenantSlug={tenantSlug} section="groups" />
    </div>
  );
}

export default function DailyKpiGroupsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка…</p>}>
      <PageInner />
    </Suspense>
  );
}
