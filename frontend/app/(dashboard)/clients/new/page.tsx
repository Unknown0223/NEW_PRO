"use client";

import { ClientEditForm } from "@/components/clients/client-edit-form";
import { PageShell } from "@/components/dashboard/page-shell";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewClientPage() {
  const router = useRouter();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      </PageShell>
    );
  }

  if (!tenantSlug) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-[min(100%,90rem)]">
      <ClientEditForm
        tenantSlug={tenantSlug}
        mode="create"
        onSuccess={(createdId) => router.push(`/clients/${createdId}`)}
        onCancel={() => router.push("/clients")}
      />
    </PageShell>
  );
}
