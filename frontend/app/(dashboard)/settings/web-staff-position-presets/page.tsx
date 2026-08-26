"use client";

import Link from "next/link";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { WebStaffPositionPresetsWorkspace } from "@/components/settings/web-staff-position-presets-workspace";

export default function WebStaffPositionPresetsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  if (role !== "admin") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Bu bo‘lim faqat administrator uchun.</p>
        <Link href="/settings" className="text-sm text-primary underline">
          ← Настройки
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Должности</h1>
        <Link href="/settings" className="text-sm text-primary underline">
          ← Настройки
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Lavozim nomi xodim kartasidagi «Должность» maydoniga yoziladi; «Роль» tizim roli bilan bog‘lanadi
        (agent, ekspeditor, ofis…). Nom o‘zgartirilsa, bog‘langan xodimlar avtomatik yangilanadi. Ro‘yxat{" "}
        <Link href="/settings/spravochnik/operators" className="text-primary underline">
          Пользователи
        </Link>{" "}
        va KOMANDA formalarida tanlov sifatida ishlatiladi.
      </p>
      <WebStaffPositionPresetsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
