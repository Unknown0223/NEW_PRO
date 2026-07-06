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
        <p className="text-sm text-destructive">Skladchiklarni boshqarish faqat administrator uchun.</p>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Spravochnik
        </Link>
      </div>
    );
  }

  return <SkladchikWorkspace tenantSlug={tenantSlug} />;
}
