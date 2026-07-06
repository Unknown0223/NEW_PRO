"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { clampTablePageSize, DEFAULT_TABLE_PAGE_SIZES, normalizeTablePageSizes } from "@/lib/table-page-sizes";

export type UserTableUiState = {
  columnOrder?: string[];
  hiddenColumnIds?: string[];
  pageSize?: number;
  /** Masalan `grid` | `list` (jadval/kartochka ko‘rinishi). */
  viewMode?: string;
};

type UiRoot = { tables?: Record<string, UserTableUiState> };

const queryKey = (tenantSlug: string | null | undefined) => ["me", "ui-preferences", tenantSlug] as const;

export function useUserTablePrefs({
  tenantSlug,
  tableId,
  defaultColumnOrder,
  defaultPageSize = 10,
  allowedPageSizes = DEFAULT_TABLE_PAGE_SIZES,
  defaultHiddenColumnIds,
  defaultViewMode
}: {
  tenantSlug: string | null | undefined;
  tableId: string;
  defaultColumnOrder: readonly string[];
  defaultPageSize?: number;
  allowedPageSizes?: readonly number[];
  /** Serverda jadval prefs yo‘q yoki faqat pageSize bo‘lsa — boshlang‘ich yashirin ustunlar */
  defaultHiddenColumnIds?: readonly string[];
  defaultViewMode?: "grid" | "list";
}) {
  const qc = useQueryClient();

  const normalizedAllowedPageSizes = useMemo(
    () => normalizeTablePageSizes(allowedPageSizes),
    [allowedPageSizes]
  );

  const prefsQ = useQuery({
    queryKey: queryKey(tenantSlug ?? null),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ data: UiRoot }>(`/api/${tenantSlug}/me/ui-preferences`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (patch: { tables: Record<string, UserTableUiState> }) => {
      const { data } = await api.patch<{ data: UiRoot }>(`/api/${tenantSlug}/me/ui-preferences`, patch);
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKey(tenantSlug ?? null) });
    }
  });

  const saved = prefsQ.data?.tables?.[tableId];

  const hiddenColumnIds = useMemo(() => {
    if (saved === undefined) {
      return new Set(defaultHiddenColumnIds ?? []);
    }
    const hasColPrefs =
      Array.isArray(saved.hiddenColumnIds) ||
      (Array.isArray(saved.columnOrder) && saved.columnOrder.length > 0);
    if (hasColPrefs) {
      return new Set(saved.hiddenColumnIds ?? []);
    }
    return new Set(defaultHiddenColumnIds ?? []);
  }, [saved, defaultHiddenColumnIds]);

  const columnOrder = useMemo(() => {
    const raw = saved?.columnOrder;
    const base = [...defaultColumnOrder];
    if (!raw?.length) return base;
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of raw) {
      if (base.includes(id) && !seen.has(id)) {
        ordered.push(id);
        seen.add(id);
      }
    }
    for (const id of base) {
      if (!seen.has(id)) ordered.push(id);
    }
    return ordered;
  }, [saved?.columnOrder, defaultColumnOrder]);

  const pageSize = useMemo(() => {
    const ps = saved?.pageSize;
    if (ps != null) return clampTablePageSize(ps, normalizedAllowedPageSizes);
    return normalizedAllowedPageSizes.includes(defaultPageSize)
      ? defaultPageSize
      : normalizedAllowedPageSizes[0]!;
  }, [saved?.pageSize, normalizedAllowedPageSizes, defaultPageSize]);

  const viewMode = useMemo((): "grid" | "list" => {
    const v = saved?.viewMode;
    if (v === "grid" || v === "list") return v;
    return defaultViewMode === "list" ? "list" : "grid";
  }, [saved?.viewMode, defaultViewMode]);

  const visibleColumnOrder = useMemo(
    () => columnOrder.filter((id) => !hiddenColumnIds.has(id)),
    [columnOrder, hiddenColumnIds]
  );

  const persistTable = useCallback(
    (partial: UserTableUiState) => {
      if (!tenantSlug) return;
      patchMut.mutate({ tables: { [tableId]: partial } });
    },
    [tenantSlug, tableId, patchMut]
  );

  return {
    prefsLoading: prefsQ.isLoading,
    columnOrder,
    hiddenColumnIds,
    visibleColumnOrder,
    pageSize,
    viewMode,
    setPageSize: (n: number) => {
      const next = clampTablePageSize(n, normalizedAllowedPageSizes);
      if (!normalizedAllowedPageSizes.includes(next)) return;
      persistTable({ pageSize: next });
    },
    setViewMode: (mode: "grid" | "list") => {
      persistTable({ viewMode: mode });
    },
    saveColumnLayout: (next: { columnOrder: string[]; hiddenColumnIds: string[] }) => {
      persistTable({ columnOrder: next.columnOrder, hiddenColumnIds: next.hiddenColumnIds });
    },
    resetColumnLayout: () => {
      persistTable({
        columnOrder: [...defaultColumnOrder],
        hiddenColumnIds: [...(defaultHiddenColumnIds ?? [])]
      });
    },
    saving: patchMut.isPending
  };
}
