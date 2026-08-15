"use client";

import { ActivityWorkspace } from "@/components/activity/activity-workspace";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";

export default function ActivityPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }
  if (role !== "admin") {
    return <p className="text-sm text-destructive">Этот раздел доступен только администратору.</p>;
  }
  return <ActivityWorkspace tenantSlug={tenantSlug} />;
}
