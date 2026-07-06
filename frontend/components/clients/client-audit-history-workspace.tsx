"use client";

import { useClientAuditHistory } from "@/hooks/use-client-audit-history";
import { formatClientAuditCreatedShort } from "@/lib/client-audit-history";
import type { ClientDetailApiRow } from "@/components/clients/client-detail-view";
import { ClientAuditSnapshotTable } from "@/components/clients/client-audit-snapshot-table";
import { ClientAuditHistoryShell } from "@/components/clients/client-audit-history-shell";
import { ClientHistoryToolbar } from "@/components/clients/client-history-toolbar";

type Props = {
  tenantSlug: string;
  clientId: number;
  client?: ClientDetailApiRow | null;
  /** Шаблон App: topbar + Timeline */
  variant?: "shell" | "plain";
  /** Profil ichida — ichki scroll (viewport balandligi). Sahifada — false. */
  embedded?: boolean;
  initialTimelineOpen?: boolean;
  className?: string;
};

export function ClientAuditHistoryWorkspace({
  tenantSlug,
  clientId,
  client,
  variant = "plain",
  embedded = false,
  initialTimelineOpen = false,
  className
}: Props) {
  const { model, loading, error } = useClientAuditHistory(tenantSlug, clientId, client);

  if (loading) {
    return <p className="text-sm text-slate-500">Загрузка истории…</p>;
  }

  if (error || !model) {
    return <p className="text-sm text-rose-600">Не удалось загрузить журнал изменений.</p>;
  }

  const table = (
    <ClientAuditSnapshotTable
      clientName={model.clientName}
      createdBy={model.createdBy}
      createdAtShort={formatClientAuditCreatedShort(model.createdAt)}
      columns={model.snapshots}
    />
  );

  if (variant === "plain") {
    return table;
  }

  return (
    <ClientAuditHistoryShell
      className={className}
      embedded={embedded}
      timeline={
        <ClientHistoryToolbar model={model} loading={loading} initialOpen={initialTimelineOpen} />
      }
    >
      {table}
    </ClientAuditHistoryShell>
  );
}
