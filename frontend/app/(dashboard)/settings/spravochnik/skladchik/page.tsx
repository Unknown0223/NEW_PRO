"use client";

import Link from "next/link";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { SkladchikWorkspace } from "@/components/staff/skladchik-workspace";

export default function SkladchikSpravochnikPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  if (role !== "admin") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Управление кладовщиками доступно только администратору.</p>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Справочник
        </Link>
      </div>
    );
  }

  return <SkladchikWorkspace tenantSlug={tenantSlug} />;
}
