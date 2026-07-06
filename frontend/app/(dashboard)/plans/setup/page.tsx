"use client";

import Link from "next/link";
import { Suspense } from "react";
import { PlanningWorkspace } from "@/components/plans/setup/planning-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

function PlanSetupPageInner() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const perms = usePermissions();

  if (!hydrated) return <p className="p-6 text-sm text-muted-foreground">Загрузка сессии…</p>;
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Сессия не найдена.{" "}
        <Link href="/login" className="text-primary underline">
          Войти
        </Link>
      </p>
    );
  }
  if (!perms.isLoading && !perms.has("plans.ustanovka_planov.view")) {
    return <p className="p-6 text-sm text-muted-foreground">Нет доступа к этому разделу.</p>;
  }

  return (
    <div className="space-y-4 p-1">
      <PlanningWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}

export default function PlanSetupPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка…</p>}>
      <PlanSetupPageInner />
    </Suspense>
  );
}
