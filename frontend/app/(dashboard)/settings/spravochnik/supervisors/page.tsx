"use client";

import { useSearchParams } from "next/navigation";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SupervisorsWorkspace } from "@/components/staff/supervisors-workspace";

export default function SupervisorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const searchParams = useSearchParams();
  const initialCreateOpen = searchParams.get("create") === "1";

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return <SupervisorsWorkspace tenantSlug={tenantSlug} initialCreateOpen={initialCreateOpen} />;
}
