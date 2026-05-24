"use client";

import Link from "next/link";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { AuditorsWorkspace } from "@/components/staff/auditors-workspace";

export default function AuditorsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Аудиторы</h1>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Spravochnik
        </Link>
      </div>
      <AuditorsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
