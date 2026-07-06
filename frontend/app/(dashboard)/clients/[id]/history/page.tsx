"use client";

import { ClientAuditHistoryWorkspace } from "@/components/clients/client-audit-history-workspace";
import { PageShell } from "@/components/dashboard/page-shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

/** Журнал — sahifa scroll (full-height emas), shablon UI. */
export default function ClientHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const clientId = Number.parseInt(idStr ?? "", 10);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const timelineOpen = searchParams.get("timeline") === "1";

  const invalid = !Number.isFinite(clientId) || clientId < 1;

  return (
    <PageShell className="space-y-4 pb-10">
      <Link
        href={invalid ? "/clients" : `/clients/${clientId}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-8 w-fit -ml-2 text-muted-foreground"
        )}
      >
        ← Профиль клиента
      </Link>

      {!hydrated ? (
        <p className="text-sm text-slate-500">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-rose-600">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      ) : invalid ? (
        <p className="text-sm text-rose-600">Некорректный идентификатор клиента.</p>
      ) : (
        <ClientAuditHistoryWorkspace
          tenantSlug={tenantSlug}
          clientId={clientId}
          variant="shell"
          embedded={false}
          initialTimelineOpen={timelineOpen}
        />
      )}
    </PageShell>
  );
}
