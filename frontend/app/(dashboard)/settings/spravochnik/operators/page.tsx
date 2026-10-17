"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";

const OperatorsWorkspace = dynamic(
  () => import("@/components/staff/operators-workspace").then((m) => m.OperatorsWorkspace),
  {
    loading: () => <p className="text-sm text-muted-foreground">Загрузка списка операторов…</p>,
    ssr: false
  }
);

export default function OperatorsSpravochnikPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  if (role !== "admin") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Управление веб-сотрудниками доступно только администратору.</p>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Справочник
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Веб-сотрудники</h1>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Справочник
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Сотрудники, работающие через веб-панель (пока системная роль <code className="text-foreground">operator</code>
        ); через поле «Должность» задаются названия вроде «кассир», «менеджер».
      </p>
      <OperatorsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
