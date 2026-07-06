"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type StaffKomandaApiSegment =
  | "agents"
  | "supervisors"
  | "expeditors"
  | "collectors"
  | "auditors"
  | "skladchik";

export type StaffKomandaBulkConfirm = "activate" | "deactivate" | "clear-sessions";

type RowWithAccess = { id: number; app_access: boolean };

type Options = {
  tenantSlug: string;
  apiSegment: StaffKomandaApiSegment;
  invalidateQueryKeys: unknown[][];
  selectedIds: Set<number>;
  setSelectedIds: (ids: Set<number>) => void;
  selectedRows: RowWithAccess[];
};

export function useStaffKomandaBulk({
  tenantSlug,
  apiSegment,
  invalidateQueryKeys,
  selectedIds,
  setSelectedIds,
  selectedRows
}: Options) {
  const qc = useQueryClient();
  const [confirmBulk, setConfirmBulk] = useState<StaffKomandaBulkConfirm | null>(null);

  const invalidate = () => {
    for (const queryKey of invalidateQueryKeys) {
      void qc.invalidateQueries({ queryKey });
    }
  };

  const allAccessOn = useMemo(() => {
    if (selectedRows.length === 0) return false;
    return selectedRows.every((r) => r.app_access);
  }, [selectedRows]);

  const bulkAccessMut = useMutation({
    mutationFn: async (app_access: boolean) => {
      const ids = Array.from(selectedIds);
      if (apiSegment === "agents") {
        await api.post(`/api/${tenantSlug}/agents/bulk`, {
          action: "set_app_access",
          agent_ids: ids,
          app_access
        });
        return;
      }
      for (const id of ids) {
        await api.patch(`/api/${tenantSlug}/${apiSegment}/${id}`, { app_access });
      }
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds(new Set());
    }
  });

  const bulkActiveMut = useMutation({
    mutationFn: async (is_active: boolean) => {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await api.patch(`/api/${tenantSlug}/${apiSegment}/${id}`, { is_active });
      }
    },
    onSuccess: () => {
      invalidate();
      setConfirmBulk(null);
      setSelectedIds(new Set());
    }
  });

  const bulkSessionsMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      if (apiSegment === "agents") {
        await api.post(`/api/${tenantSlug}/agents/bulk`, {
          action: "revoke_sessions",
          agent_ids: ids
        });
        return;
      }
      if (apiSegment === "skladchik") {
        await api.post(`/api/${tenantSlug}/skladchik/bulk/sessions/revoke`, { user_ids: ids });
        return;
      }
      for (const id of ids) {
        await api.post(`/api/${tenantSlug}/${apiSegment}/${id}/sessions/revoke`, { all: true });
      }
    },
    onSuccess: () => {
      invalidate();
      setConfirmBulk(null);
      setSelectedIds(new Set());
    }
  });

  const bulkBusy = bulkAccessMut.isPending || bulkActiveMut.isPending || bulkSessionsMut.isPending;

  const confirmMessage =
    confirmBulk === "deactivate"
      ? "Вы хотите деактивировать выбранных сотрудников?"
      : confirmBulk === "activate"
        ? "Вы хотите активировать выбранных сотрудников?"
        : confirmBulk === "clear-sessions"
          ? "Вы хотите сбросить все сессии у выбранных сотрудников?"
          : "";

  const handleConfirmBulk = () => {
    if (confirmBulk === "clear-sessions") {
      void bulkSessionsMut.mutateAsync();
      return;
    }
    if (confirmBulk === "deactivate") {
      void bulkActiveMut.mutateAsync(false);
      return;
    }
    if (confirmBulk === "activate") {
      void bulkActiveMut.mutateAsync(true);
    }
  };

  return {
    allAccessOn,
    bulkBusy,
    confirmBulk,
    setConfirmBulk,
    confirmMessage,
    handleConfirmBulk,
    onToggleAccess: () => void bulkAccessMut.mutateAsync(!allAccessOn),
    onRequestToggleActive: (isActiveTab: boolean) =>
      setConfirmBulk(isActiveTab ? "deactivate" : "activate"),
    onClearSessions: () => setConfirmBulk("clear-sessions")
  };
}
