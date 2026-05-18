"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { AccessRoleDefaultsWorkspace } from "@/components/access/access-role-defaults-workspace";
import { useAccessModuleGate } from "@/lib/use-access-module-gate";

export default function AccessRoleDefaultsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const gate = useAccessModuleGate(tenantSlug, role);
  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (gate.isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (!gate.allowed) return <p className="text-sm text-destructive">Недостаточно прав (нужны admin или access.manage).</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
        <Link
          href="/access"
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted/60",
            "no-underline"
          )}
          aria-label="Назад к разделу «Доступ»"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Состав ролей по умолчанию</h1>
      </div>
      <AccessRoleDefaultsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
