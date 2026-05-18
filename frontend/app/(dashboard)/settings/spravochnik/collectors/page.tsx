"use client";

import Link from "next/link";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { CollectorsWorkspace } from "@/components/staff/collectors-workspace";

export default function CollectorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Инкассатор</h1>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Spravochnik
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Управление инкассаторами: территории, кассы, доступ к приложению и контроль сессий.
      </p>
      <CollectorsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
