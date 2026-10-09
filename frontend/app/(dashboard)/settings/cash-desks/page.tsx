"use client";

import Link from "next/link";
import { CashDesksWorkspace } from "@/components/cash-desks/cash-desks-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

export default function CashDesksSettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { has, isLoading } = usePermissions();
  const canCreate = has("cash.kassa.create");
  const canUpdate = has("cash.kassa.update");
  const canHistory = has("cash.kassa.history");
  const canStatus = has("cash.kassa.status");
  const canExport = has("cash.kassa.export");

  if (!hydrated || isLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }
  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Кассы</h1>
        <Link href="/settings" className="text-sm text-primary underline">
          ← Настройки
        </Link>
      </div>
      <CashDesksWorkspace
        tenantSlug={tenantSlug}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canHistory={canHistory}
        canStatus={canStatus}
        canExport={canExport}
      />
    </div>
  );
}
