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
    return <p className="text-sm text-destructive">Bu bo&apos;lim faqat administrator uchun.</p>;
  }
  return <ActivityWorkspace tenantSlug={tenantSlug} />;
}
