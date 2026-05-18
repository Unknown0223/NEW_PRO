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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Складчик</h1>
        <Link href="/settings/spravochnik" className="text-sm text-primary underline">
          ← Spravochnik
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Ombor xodimlari — tizim roli <code className="text-foreground">skladchik</code>, ombor biriktirish va sessiya
        limitlari.
      </p>
      <SkladchikWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
