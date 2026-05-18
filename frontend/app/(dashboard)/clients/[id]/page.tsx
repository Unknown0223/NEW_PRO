"use client";

import dynamic from "next/dynamic";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useParams } from "next/navigation";

const ClientProfileHub = dynamic(
  () => import("@/components/clients/client-profile-hub").then((m) => m.ClientProfileHub),
  {
    loading: () => <p className="text-sm text-muted-foreground">Загрузка данных клиента…</p>,
    ssr: false
  }
);

const PageShell = dynamic(
  () => import("@/components/dashboard/page-shell").then((m) => m.PageShell),
  { ssr: false }
);

export default function ClientDetailPage() {
  const params = useParams();
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const clientId = Number.parseInt(idStr ?? "", 10);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const invalid = !Number.isFinite(clientId) || clientId < 1;

  return (
    <PageShell className="pb-12">
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      ) : invalid ? (
        <p className="text-sm text-destructive">Некорректный идентификатор клиента.</p>
      ) : (
        <ClientProfileHub tenantSlug={tenantSlug} clientId={clientId} />
      )}
    </PageShell>
  );
}
