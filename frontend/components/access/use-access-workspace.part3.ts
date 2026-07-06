"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { filterAccessWebAssignableUsers } from "@/lib/access-web-users";
import type { SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import {
  ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
  ACCESS_MANAGE_KEY,
  applyOptimisticOperationDimPatch,
  buildScopeDimensionPatchBody,
  collectScopeDimensionModalBulkItems,
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

import type { useAccessWorkspacePart2 } from "./use-access-workspace.part2";

export function useAccessWorkspacePart3(ctx: ReturnType<typeof useAccessWorkspacePart2>) {
  const { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } = ctx;

  const { operationAccessMut, opDimAccessBusyUserId, getOpEffective, getAccessManagePatchBody, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } = ctx;

  const operationUsers = useMemo(() => {
    if (tab !== "operations") return [] as DimensionUserRow[];
    return (dimensionUsersQ.data ?? []).filter((u) => u.is_active && getOpEffective(u));
  }, [tab, dimensionUsersQ.data, getOpEffective]);

  const cashUsers = useMemo(() => {
    if (!isScopeDimensionTab(tab)) {
      return [] as DimensionUserRow[];
    }
    return (dimensionUsersQ.data ?? []).filter((u) => u.is_active);
  }, [tab, dimensionUsersQ.data]);

  const opModalUsers = useMemo(
    () => filterAccessWebAssignableUsers(allUsersForOperationModalQ.data ?? []),
    [allUsersForOperationModalQ.data]
  );

  const opModalUsersById = useMemo(() => {
    const m = new Map<number, AccessUserRow>();
    for (const u of opModalUsers) m.set(u.id, u);
    return m;
  }, [opModalUsers]);

  /** Har `dimensionUsers` refetchida tanlovni qayta tiklamaslik — aks holda «Выбрать все»dan keyin «Сохранить» bo‘sh qoladi. */
  const operationUsersModalRef = useRef(operationUsers);
  operationUsersModalRef.current = operationUsers;

  useEffect(() => {
    if (!opUsersModalOpen || tab !== "operations") return;
    const next = new Set<number>();
    for (const u of operationUsersModalRef.current) {
      if (getOpEffective(u)) next.add(u.id);
    }
    setOpUsersModalSelected(next);
  }, [opUsersModalOpen, tab, selectedDimension?.key, getOpEffective]);

  /**
   * Кассы / склады / филиалы: галочки = фактические привязки из `scope` полного списка пользователей, а не строка
   * `dimensions/users` (она может отставать из‑за keepPreviousData или загрузки).
   */
  useEffect(() => {
    if (!opUsersModalOpen) return;
    if (!isScopeDimensionTab(tab)) return;
    const k = selectedDimension?.key;
    if (!k) return;
    const fullList = filterAccessWebAssignableUsers(allUsersForOperationModalQ.data ?? []);
    if (allUsersForOperationModalQ.isLoading && fullList.length === 0) {
      setOpUsersModalSelected(new Set());
      return;
    }
    const next = new Set<number>();
    for (const u of fullList) {
      if (scopeUserHasObjectAttachment(tab, k, u)) next.add(u.id);
    }
    setOpUsersModalSelected(next);
  }, [
    opUsersModalOpen,
    tab,
    selectedDimension?.key,
    allUsersForOperationModalQ.isLoading,
    allUsersForOperationModalQ.data,
    allUsersForOperationModalQ.dataUpdatedAt
  ]);

  /** Faqat yo‘qolgan rollarni tozalash — «Развернуть все» ni `yangi Set(barcha rollar)` dan keyin qayta qisqartirmaslik. */
  useEffect(() => {
    if (!opUsersModalOpen || tab !== "operations") return;
    const valid = new Set(
      opModalUsers.map((u) => (String(u.role || "").trim() || "Без роли"))
    );
    setOpUsersModalExpandedRoles((prev) => {
      const next = new Set<string>();
      for (const r of prev) {
        if (valid.has(r)) next.add(r);
      }
      if (next.size === prev.size && [...prev].every((r) => next.has(r))) return prev;
      return next;
    });
  }, [opUsersModalOpen, tab, opModalUsers]);

  /** Модалка выбора пользователей — группы по ролям по умолчанию свёрнуты («Развернуть все» по желанию). */
  useEffect(() => {
    if (!opUsersModalOpen) return;
    setOpUsersModalExpandedRoles(new Set());
  }, [opUsersModalOpen, usersModalKind, selectedDimension?.key]);

  const operationRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of operationUsers) {
      const r = String(u.role || "").trim();
      if (r) s.add(r);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [operationUsers]);

  const operationPositionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of operationUsers) {
      const p = String(u.position || "").trim();
      if (p) s.add(p);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [operationUsers]);

  const operationRoleFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] =>
      operationRoleOptions.map((r) => ({ id: r, title: r })),
    [operationRoleOptions]
  );

  const operationPositionFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] =>
      operationPositionOptions.map((p) => ({ id: p, title: p })),
    [operationPositionOptions]
  );

  const cashRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of cashUsers) {
      const r = String(u.role || "").trim();
      if (r) s.add(r);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [cashUsers]);

  const cashPositionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of cashUsers) {
      const p = String(u.position || "").trim();
      if (p) s.add(p);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [cashUsers]);

  const cashRoleFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] => cashRoleOptions.map((r) => ({ id: r, title: r })),
    [cashRoleOptions]
  );

  const cashPositionFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] => cashPositionOptions.map((p) => ({ id: p, title: p })),
    [cashPositionOptions]
  );

  const filteredOperationUsers = useMemo(() => {
    if (tab !== "operations") return [] as DimensionUserRow[];
    const q = opSearch.trim().toLowerCase();
    return operationUsers.filter((u) => {
      const roleStr = String(u.role ?? "").trim();
      if (opFilterRoles.size > 0 && !opFilterRoles.has(roleStr)) return false;
      const posStr = String(u.position ?? "").trim();
      if (opFilterPositions.size > 0 && !opFilterPositions.has(posStr)) return false;
      const canGrant = Boolean(u.has_access_manage);
      if (
        opFilterGrants.size > 0 &&
        !((opFilterGrants.has("allowed") && canGrant) || (opFilterGrants.has("denied") && !canGrant))
      ) {
        return false;
      }
      if (
        opFilterActivities.size > 0 &&
        !((opFilterActivities.has("active") && u.is_active) || (opFilterActivities.has("inactive") && !u.is_active))
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${u.full_name} ${u.login} ${u.code ?? ""} ${u.role} ${u.position ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tab, opSearch, opFilterRoles, opFilterPositions, opFilterGrants, opFilterActivities, operationUsers]);

  const filteredCashUsers = useMemo(() => {
    if (!isScopeDimensionTab(tab)) {
      return [] as DimensionUserRow[];
    }
    const q = cashSearch.trim().toLowerCase();
    return cashUsers.filter((u) => {
      const roleStr = String(u.role ?? "").trim();
      if (cashFilterRoles.size > 0 && !cashFilterRoles.has(roleStr)) return false;
      const posStr = String(u.position ?? "").trim();
      if (cashFilterPositions.size > 0 && !cashFilterPositions.has(posStr)) return false;
      if (
        cashFilterActivities.size > 0 &&
        !(
          (cashFilterActivities.has("active") && u.is_active) ||
          (cashFilterActivities.has("inactive") && !u.is_active)
        )
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${u.full_name} ${u.login} ${u.code ?? ""} ${u.role} ${u.position ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tab, cashSearch, cashFilterRoles, cashFilterPositions, cashFilterActivities, cashUsers]);

  const displayOperationUsers = useMemo(
    () => sortDimUserRows(filteredOperationUsers, opDimUserSort),
    [filteredOperationUsers, opDimUserSort]
  );

  const displayCashUsers = useMemo(
    () => sortDimUserRows(filteredCashUsers, scopeDimUserSort),
    [filteredCashUsers, scopeDimUserSort]
  );

  const opDimRowVirtualizer = useVirtualizer({
    count: tab === "operations" ? displayOperationUsers.length : 0,
    getScrollElement: () => dimTableBodyScrollRef.current,
    estimateSize: () => ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
    overscan: 12
  });

  const scopeDimRowVirtualizer = useVirtualizer({
    count:
      isScopeDimensionTab(tab)
        ? displayCashUsers.length
        : 0,
    getScrollElement: () => dimTableBodyScrollRef.current,
    estimateSize: () => ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
    overscan: 12
  });

  useEffect(() => {
    opDimRowVirtualizer.scrollToOffset(0);
    scopeDimRowVirtualizer.scrollToOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll reset faqat kontekst (tab / tanlangan kalit) almashtirilganda
  }, [selectedKey, tab]);

  return { ...ctx, operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer } as const;
}
