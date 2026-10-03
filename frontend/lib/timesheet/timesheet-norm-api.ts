"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore } from "@/lib/auth-store";
import type { TabelAuditRecord } from "@/lib/tabel/tabel-api";

export type AgentNormSettings = {
  enabled: boolean;
  start_date: string;
  open_amount: number;
  closed_amount: number;
  updated_at: string | null;
  updated_by: string | null;
};

export type AgentNormSettingsInput = Omit<AgentNormSettings, "updated_at" | "updated_by"> & { comment?: string };

export function useAgentNormSettings(enabled: boolean) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  return useQuery({
    queryKey: ["timesheet-norm-settings", tenantSlug],
    enabled: Boolean(tenantSlug) && enabled,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: AgentNormSettings }>(`/api/${tenantSlug}/timesheet/norm-settings`);
      return data.data;
    }
  });
}

export function useSaveAgentNormSettings() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AgentNormSettingsInput) => {
      const { data } = await api.put<{ data: AgentNormSettings }>(`/api/${tenantSlug}/timesheet/norm-settings`, input);
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timesheet-norm-settings", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["timesheet-matrix", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["timesheet-history", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["tabel-audit", tenantSlug] });
    }
  });
}

export function useTimesheetHistory(enabled: boolean) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  return useQuery({
    queryKey: ["timesheet-history", tenantSlug],
    enabled: Boolean(tenantSlug) && enabled,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: { records: TabelAuditRecord[] } }>(`/api/${tenantSlug}/timesheet/history`);
      return data.data.records;
    }
  });
}
