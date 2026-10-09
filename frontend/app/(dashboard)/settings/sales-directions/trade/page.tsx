"use client";

import { TradeDirectionsWorkspace } from "@/components/settings/sales-directions/trade-directions-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";

export default function TradeDirectionsSettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Направление торговли</h1>
        <Link href="/settings/company" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Настройки
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Значения списка выбираются в поле «Направление торговли» у агента и экспедитора; для клиентов и бонусов есть
        отдельные справочники.
      </p>
      <TradeDirectionsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
