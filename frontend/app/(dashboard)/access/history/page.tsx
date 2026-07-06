"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { AccessHistoryWorkspace } from "@/components/access/access-history-workspace";
import { useAccessModuleGate } from "@/lib/use-access-module-gate";

export default function AccessHistoryPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const gate = useAccessModuleGate(tenantSlug, role);
  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (gate.isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (!gate.allowed) return <p className="text-sm text-destructive">Недостаточно прав (нужны admin или доступ к разделу «Доступ»).</p>;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-col gap-4 px-3 pb-4 pt-4 sm:px-4 lg:px-6">
      <div className="flex min-h-16 flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href="/access"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "mt-0.5 h-8 w-8 shrink-0 no-underline"
            )}
            aria-label="Назад к разделу «Доступ»"
            title="Доступ"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">История изменения доступов</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Журнал действий с правами и областями доступа — фильтр, поиск и выгрузка в Excel.
            </p>
          </div>
        </div>
      </div>
      <AccessHistoryWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
