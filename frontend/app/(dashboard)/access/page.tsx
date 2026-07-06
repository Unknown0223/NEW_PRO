"use client";

import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { AccessWorkspace } from "@/components/access/access-workspace";
import { useAccessModuleGate } from "@/lib/use-access-module-gate";

export default function AccessPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const gate = useAccessModuleGate(tenantSlug, role);

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (gate.isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (!gate.allowed) return <p className="text-sm text-destructive">Недостаточно прав (нужны admin или доступ к разделу «Доступ»).</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Доступ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Пользователи, операции и области — назначение прав и просмотр привязок.</p>
      </div>
      <AccessWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
