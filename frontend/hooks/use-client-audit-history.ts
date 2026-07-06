"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import {
  buildClientAuditHistoryViewModel,
  clientAuditAllQueryKey,
  type ClientAuditLogRow,
  type ClientAuditHistoryViewModel
} from "@/lib/client-audit-history";
import type { ClientDetailApiRow } from "@/components/clients/client-detail-view";

async function fetchAllClientAuditLogs(
  tenantSlug: string,
  clientId: number
): Promise<ClientAuditLogRow[]> {
  const limit = 100;
  const all: ClientAuditLogRow[] = [];
  let page = 1;
  while (page <= 50) {
    const { data } = await api.get<{
      data: ClientAuditLogRow[];
      total: number;
    }>(`/api/${tenantSlug}/clients/${clientId}/audit?page=${page}&limit=${limit}`);
    all.push(...data.data);
    if (all.length >= data.total || data.data.length < limit) break;
    page += 1;
  }
  return all;
}

export function useClientAuditHistory(
  tenantSlug: string,
  clientId: number,
  client?: ClientDetailApiRow | null
) {
  const clientQ = useQuery({
    queryKey: ["client", tenantSlug, clientId, "audit-history"],
    enabled: Boolean(tenantSlug) && clientId > 0 && !client,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<ClientDetailApiRow>(`/api/${tenantSlug}/clients/${clientId}`);
      return data;
    }
  });

  const auditQ = useQuery({
    queryKey: clientAuditAllQueryKey(tenantSlug, clientId),
    enabled: Boolean(tenantSlug) && clientId > 0,
    staleTime: STALE.list,
    queryFn: () => fetchAllClientAuditLogs(tenantSlug, clientId)
  });

  const resolvedClient = client ?? clientQ.data ?? null;

  const model = useMemo((): ClientAuditHistoryViewModel | null => {
    if (!resolvedClient || !auditQ.data) return null;
    return buildClientAuditHistoryViewModel(resolvedClient, auditQ.data);
  }, [resolvedClient, auditQ.data]);

  return {
    model,
    client: resolvedClient,
    loading: auditQ.isLoading || (!client && clientQ.isLoading),
    error: auditQ.isError || clientQ.isError,
    refetch: () => {
      void auditQ.refetch();
      if (!client) void clientQ.refetch();
    }
  };
}
