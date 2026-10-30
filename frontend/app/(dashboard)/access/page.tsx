"use client";

import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { AccessWorkspace } from "@/components/access/access-workspace";
import { AccessDeniedBanner } from "@/components/access/access-denied-banner";
import { useAccessModuleGate } from "@/lib/use-access-module-gate";

export default function AccessPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const gate = useAccessModuleGate(tenantSlug, role);

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (gate.isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (!gate.allowed) {
    return (
      <div className="flex flex-1 items-start justify-center p-6 sm:p-10">
        <AccessDeniedBanner
          title="Нет доступа"
          message="Недостаточно прав для раздела «Доступ» (нужны admin или access.upravlenie.view)."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AccessWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
