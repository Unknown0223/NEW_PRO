"use client";

/**
 * Серверный слой данных для модулей «Табель», «Рабочие дни» и «Аудит».
 * Графики/исключения/индивидуальные графики и журнал аудита персистятся на
 * backend (`tenant.settings`), а не в localStorage.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore } from "@/lib/auth-store";
import {
  DEFAULT_SCHEDULES,
  cloneSchedules,
  type EmployeeOverride,
  type ExceptionType,
  type Schedule,
  type ScheduleMap,
  type WdRole,
  type WorkdayException,
  WD_ROLES
} from "@/lib/tabel/workdays-logic";

export type TabelAuditModule = "timesheet" | "workdays";
export type TabelAuditKind = "status" | "schedule" | "exception" | "override";

export interface TabelAuditRecord {
  id: string;
  module: TabelAuditModule;
  kind: TabelAuditKind;
  title: string;
  subtitle?: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
  changedBy: string;
  changedAt: string;
}

export interface WorkdaysState {
  schedules: ScheduleMap;
  exceptions: WorkdayException[];
  overrides: EmployeeOverride[];
}

function normalizeState(raw: Partial<WorkdaysState> | undefined): WorkdaysState {
  const schedules = cloneSchedules(DEFAULT_SCHEDULES);
  if (raw?.schedules) {
    for (const r of WD_ROLES) {
      const s = raw.schedules[r];
      if (Array.isArray(s) && s.length === 7) schedules[r] = s.map(Boolean);
    }
  }
  return {
    schedules,
    exceptions: Array.isArray(raw?.exceptions) ? raw!.exceptions : [],
    overrides: Array.isArray(raw?.overrides) ? raw!.overrides : []
  };
}

export function useWorkdaysState() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  return useQuery({
    queryKey: ["workdays-state", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkdaysState }>(`/api/${tenantSlug}/workdays`);
      return normalizeState(data.data);
    }
  });
}

export function useTabelAudit() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  return useQuery({
    queryKey: ["tabel-audit", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: { records: TabelAuditRecord[] } }>(`/api/${tenantSlug}/tabel-audit`);
      return data.data.records;
    }
  });
}

export function useWorkdaysMutations() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["workdays-state", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["tabel-audit", tenantSlug] });
  };

  const saveSchedules = useMutation({
    mutationFn: async (schedules: ScheduleMap) => {
      await api.put(`/api/${tenantSlug}/workdays/schedules`, { schedules });
    },
    onSuccess: invalidate
  });

  const addException = useMutation({
    mutationFn: async (ex: { role: WdRole | "ALL"; date: string; type: ExceptionType; comment: string }) => {
      await api.post(`/api/${tenantSlug}/workdays/exceptions`, ex);
    },
    onSuccess: invalidate
  });

  const removeException = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/${tenantSlug}/workdays/exceptions/${encodeURIComponent(id)}`);
    },
    onSuccess: invalidate
  });

  const upsertOverride = useMutation({
    mutationFn: async (ov: {
      employeeId: string;
      employeeName: string;
      employeeCode: string;
      position: string;
      schedule: Schedule;
      comment: string;
    }) => {
      await api.post(`/api/${tenantSlug}/workdays/overrides`, ov);
    },
    onSuccess: invalidate
  });

  const removeOverride = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/${tenantSlug}/workdays/overrides/${encodeURIComponent(id)}`);
    },
    onSuccess: invalidate
  });

  return { saveSchedules, addException, removeException, upsertOverride, removeOverride };
}
