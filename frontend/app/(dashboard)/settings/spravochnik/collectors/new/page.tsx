"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { StaffCreateForm } from "@/components/staff/staff-create-form";

export default function CollectorCreatePage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const router = useRouter();

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Новый инкассатор</h1>
        <Link href="/settings/spravochnik/collectors" className="text-sm text-primary underline">
          ← Инкассатор
        </Link>
      </div>
      <StaffCreateForm
        kind="collector"
        tenantSlug={tenantSlug}
        onSuccess={() => router.push("/settings/spravochnik/collectors")}
        onCancel={() => router.push("/settings/spravochnik/collectors")}
      />
    </div>
  );
}
