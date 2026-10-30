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
        <p className="text-sm text-destructive">Этот раздел только для администратора.</p>
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
        Название должности записывается в поле «Должность» карточки сотрудника; «Роль» связывается с системной
        ролью (агент, экспедитор, офис…). При переименовании связанные сотрудники обновляются автоматически. Список
        используется для выбора в формах{" "}
        <Link href="/settings/spravochnik/operators" className="text-primary underline">
          Пользователи
        </Link>{" "}
        и «Команда».
      </p>
      <WebStaffPositionPresetsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
