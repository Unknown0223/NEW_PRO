"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TableSortDir } from "@/components/ui/table-sort-button";
import type { SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import { filterAccessWebPanelUsers } from "@/lib/access-web-users";
import {
  ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
  ACCESS_MANAGE_KEY,
  applyOptimisticAccessManagePatch,
  applyOptimisticOperationDimPatch,
  buildScopeDimensionPatchBody,
  collectScopeDimensionModalBulkItems,
  normalizeAccessGrantPermissions,
  parseOperationLabelParts,
  scopeUserHasObjectAttachment,
  sortAccessModalRoleKeys,
  sortDimUserRows,
  type AccessUserRow,
  type DimensionUserRow,
  type DimUserSortKey,
  type OpAccessMutCtx,
  type ScopeDimensionTab,
  isScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";

import type { useAccessWorkspacePart1 } from "./use-access-workspace.part1";

export function useAccessWorkspacePart2(ctx: ReturnType<typeof useAccessWorkspacePart1>) {
  const { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } = ctx;

  const operationAccessMut = useMutation({
    mutationFn: async ({ userId, body }: { userId: number; body: Record<string, unknown> }) => {
      await api.patch(`/api/${tenantSlug}/access/users/${userId}`, body);
    },
    onMutate: async ({ userId, body }): Promise<OpAccessMutCtx> => {
      if (tab !== "operations" || !selectedDimension?.key) {
        return { previous: null, qk: ["access-dimension-users", tenantSlug, tab, selectedDimension?.key] };
      }
      const qk = ["access-dimension-users", tenantSlug, tab, selectedDimension.key] as const;
      await qc.cancelQueries({ queryKey: qk });
      const previous = qc.getQueryData<DimensionUserRow[]>(qk) ?? null;
      if (previous) {
        const pk = selectedDimension.key;
        const touchesAccessManage =
          ((body.permissions as string[] | undefined) ?? []).includes(ACCESS_MANAGE_KEY) ||
          ((body.denied_permissions as string[] | undefined) ?? []).includes(ACCESS_MANAGE_KEY) ||
          ((body.remove_permission_keys as string[] | undefined) ?? []).includes(ACCESS_MANAGE_KEY);
        qc.setQueryData(
          qk,
          previous.map((r) => {
            if (r.id !== userId) return r;
            if (touchesAccessManage) return applyOptimisticAccessManagePatch(r, body);
            return applyOptimisticOperationDimPatch(r, body, pk);
          })
        );
      }
      return { previous, qk };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as OpAccessMutCtx | undefined;
      if (c?.previous && c.qk[2] === "operations") {
        qc.setQueryData(c.qk, c.previous);
      }
    },
    onSuccess: async (_data, _vars, ctx) => {
      const c = ctx as OpAccessMutCtx | undefined;
      if (c?.qk[2] === "operations") {
        /** Modal yopiq bo‘lsa — qo‘shimcha GET shart emas. */
        return;
      }
      await invalidateAccessWorkspaceCaches();
    }
  });

  const opDimAccessBusyUserId =
    operationAccessMut.isPending && operationAccessMut.variables
      ? operationAccessMut.variables.userId
      : null;

  const getOpEffective = useCallback((u: DimensionUserRow): boolean => {
    if (u.from_direct_deny) return false;
    return Boolean(u.from_direct_allow || u.from_role);
  }, []);

  const getAccessManagePatchBody = useCallback((u: DimensionUserRow, next: boolean): Record<string, unknown> | null => {
    const has = Boolean(u.has_access_manage);
    if (has === next) return null;
    if (next) {
      return { merge_permissions: true, permissions: normalizeAccessGrantPermissions([ACCESS_MANAGE_KEY]), denied_permissions: [] };
    }
    return { merge_permissions: true, permissions: [], denied_permissions: [ACCESS_MANAGE_KEY] };
  }, []);

  const getOpPatchBodyForToggle = useCallback((u: DimensionUserRow, next: boolean, permissionKey: string): Record<string, unknown> | null => {
    const effective = getOpEffective(u);
    if (effective === next) return null;
    if (next) {
      /** Только `remove` при deny поверх роли; без роли deny → снова включить через `merge allow`. */
      if (u.from_direct_deny && u.from_role) return { remove_permission_keys: [permissionKey] };
      if (u.from_direct_deny) return { merge_permissions: true, permissions: [permissionKey], denied_permissions: [] };
      return { merge_permissions: true, permissions: [permissionKey], denied_permissions: [] };
    }
    return { merge_permissions: true, permissions: [], denied_permissions: [permissionKey] };
  }, [getOpEffective]);

  const rows = useMemo(() => filterAccessWebPanelUsers(usersQ.data ?? []), [usersQ.data]);
  const selected = useMemo(
    () => rows.find((r) => String(r.id) === selectedKey) ?? null,
    [rows, selectedKey]
  );

  const [, startListNavTransition] = useTransition();
  /** `startTransition` bu yerda tanlovni kechiktiradi — katta jadvalda 5–7s «tovlash» kabi. */
  const selectSideRowKey = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  const sideRows = useMemo((): SideRow[] => {
    if (tab === "users") {
      return rows.map((r) => ({
        key: String(r.id),
        title: r.code ? `[${r.code}] ${r.full_name || r.login}` : r.full_name || r.login,
        subtitle: `${r.role} · ${r.operations_count} операций`,
        meta: r.status === "active" ? "Активный" : "Неактивный",
        idLine: String(r.id),
        is_active: r.status === "active",
        group: (r.role && String(r.role).trim()) || "Без роли",
        subgroup: null
      }));
    }
    return (dimensionsQ.data ?? []).map((r) => {
      const operationLabel = tab === "operations" ? parseOperationLabelParts(r.label, r.key) : null;
      return {
        key: r.key,
        title: operationLabel ? operationLabel.title : r.label,
        subtitle: `${r.attached_users_count} пользователей прикреплено`,
        meta: r.is_active ? "Активный" : "Неактивный",
        idLine: null as string | null,
        is_active: r.is_active,
        group: operationLabel ? operationLabel.group : "common",
        subgroup: operationLabel?.subgroup ?? null
      };
    });
  }, [tab, rows, dimensionsQ.data]);

  const filteredSideRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sideRows.filter((r) => {
      const matchesSearch = !q || `${r.title} ${r.subtitle}`.toLowerCase().includes(q);
      const matchesStatus = status === "active" ? r.is_active : !r.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [sideRows, search, status]);

  function isNestedOperationRow(row: SideRow): boolean {
    return tab === "operations" && Boolean(row.subgroup);
  }

  const groupedFilteredSideRows = useMemo(() => {
    const m = new Map<string, SideRow[]>();
    for (const r of filteredSideRows) {
      const k = r.group || "Прочее";
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([group, items]: [string, SideRow[]]) => ({ group, items }));
  }, [filteredSideRows]);

  const operationNestedGroups = useMemo(() => {
    if (tab !== "operations") return [] as Array<{ group: string; subgroups: Array<{ subgroup: string; items: SideRow[] }> }>;
    const groupMap = new Map<string, Map<string, SideRow[]>>();
    for (const row of filteredSideRows) {
      const first = row.group || "Прочее";
      const second = row.subgroup || "Прочее";
      const nested = groupMap.get(first) ?? new Map<string, SideRow[]>();
      const rowsBySubgroup = nested.get(second) ?? [];
      rowsBySubgroup.push(row);
      nested.set(second, rowsBySubgroup);
      groupMap.set(first, nested);
    }
    return Array.from(groupMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([group, subgroupMap]) => ({
        group,
        subgroups: Array.from(subgroupMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "ru"))
          .map(([subgroup, items]) => ({ subgroup, items }))
      }));
  }, [tab, filteredSideRows]);

  /** Список имён групп слева: при смене набора — все свёрнуты (как матрица «Операции»). */
  const leftPanelGroupListSignature = useMemo(() => {
    if (tab === "operations") {
      return operationNestedGroups.map((g) => g.group).join("\u0001");
    }
    return groupedFilteredSideRows.map((g) => g.group).join("\u0001");
  }, [tab, operationNestedGroups, groupedFilteredSideRows]);

  /** Только имена групп/подгрупп (без строк): не сбрасывать подгруппы на каждый символ поиска. */
  const operationLeftSubgroupStructureSignature = useMemo(() => {
    if (tab !== "operations") return "";
    return operationNestedGroups
      .map((g) => `${g.group}\u0002${g.subgroups.map((s) => s.subgroup).join("\u0003")}`)
      .join("\u0001");
  }, [tab, operationNestedGroups]);

  const selectedDimension = useMemo(() => {
    if (tab === "users") return null;
    return (dimensionsQ.data ?? []).find((r) => r.key === selectedKey) ?? null;
  }, [tab, dimensionsQ.data, selectedKey]);

  const dimensionUsersQ = useQuery({
    queryKey: ["access-dimension-users", tenantSlug, tab, selectedDimension?.key],
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantSlug) && tab !== "users" && Boolean(selectedDimension?.key) && !dimensionUsersApiMissing,
    retry: false,
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ type: tab, key: selectedDimension!.key });
        const { data } = await api.get<{ data: DimensionUserRow[] }>(`/api/${tenantSlug}/access/dimensions/users?${params.toString()}`);
        setDimensionUsersApiMissing(false);
        return data.data;
      } catch (error) {
        const statusCode = (error as { response?: { status?: number } })?.response?.status;
        if (statusCode === 404) {
          setDimensionUsersApiMissing(true);
          return [];
        }
        throw error;
      }
    }
  });

  const prefetchDimensionUsersForKey = useCallback(
    (key: string) => {
      if (!tenantSlug || tab === "users" || dimensionUsersApiMissing) return;
      void qc.prefetchQuery({
        queryKey: ["access-dimension-users", tenantSlug, tab, key],
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        queryFn: async () => {
          const params = new URLSearchParams({ type: tab, key });
          const { data } = await api.get<{ data: DimensionUserRow[] }>(
            `/api/${tenantSlug}/access/dimensions/users?${params.toString()}`
          );
          return data.data ?? [];
        }
      });
    },
    [qc, tenantSlug, tab, dimensionUsersApiMissing]
  );

  useEffect(() => {
    setDimensionUsersApiMissing(false);
  }, [tab, selectedDimension?.key]);

  useEffect(() => {
    if (tab !== "operations") return;
    setOpSearch("");
    setOpFilterRolesDraft(new Set());
    setOpFilterPositionsDraft(new Set());
    setOpFilterGrantsDraft(new Set());
    setOpFilterActivitiesDraft(new Set());
    setOpFilterRoles(new Set());
    setOpFilterPositions(new Set());
    setOpFilterGrants(new Set());
    setOpFilterActivities(new Set());
    setOpRoleFilterSearch("");
    setOpPosFilterSearch("");
    setOpDimBulkSel(new Set());
    setOpDimBulkFeedback(null);
    setOpDimUserSort(null);
  }, [tab, selectedDimension?.key]);

  useEffect(() => {
    if (!isScopeDimensionTab(tab)) return;
    setCashSearch("");
    setCashFilterRolesDraft(new Set());
    setCashFilterPositionsDraft(new Set());
    setCashFilterActivitiesDraft(new Set());
    setCashFilterRoles(new Set());
    setCashFilterPositions(new Set());
    setCashFilterActivities(new Set());
    setCashRoleFilterSearch("");
    setCashPosFilterSearch("");
    setScopeDimBulkSel(new Set());
    setScopeDimBulkFeedback(null);
    setScopeDimUserSort(null);
  }, [tab, selectedDimension?.key]);
  return { ...ctx, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getAccessManagePatchBody, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } as const;
}
