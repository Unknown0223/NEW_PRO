"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TableSortDir } from "@/components/ui/table-sort-button";
import type { SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import { invalidateMePermissionsQueries } from "@/lib/me-permissions";
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

import type { useAccessWorkspacePart4 } from "./use-access-workspace.part4";

export function useAccessWorkspacePart5(ctx: ReturnType<typeof useAccessWorkspacePart4>) {
  const { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } = ctx;

  const { operationAccessMut, opDimAccessBusyUserId, getOpEffective, getAccessManagePatchBody, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } = ctx;

  const { operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer } = ctx;

  const { toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById, modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn, toggleOpDimSelectAllVisible, bulkApplyOpDimAccessManage, bulkApplyOpDimEffective, bulkDetachOpDimSelected, opDimSelectedDetachableCount, isScopeDimensionTab, scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks } = ctx;

  const opModalRoleGroups = useMemo(() => {
    const q = opUsersModalSearch.trim().toLowerCase();
    const groups = new Map<string, AccessUserRow[]>();
    for (const u of opModalUsers) {
      const role = String(u.role || "").trim() || "Без роли";
      const matchesSearch =
        !q || `${u.full_name || ""} ${u.login} ${u.code || ""} ${u.role || ""} ${u.branch || ""}`.toLowerCase().includes(q);
      if (!matchesSearch) continue;
      if (opUsersModalShowSelected && !opUsersModalSelected.has(u.id)) continue;
      const arr = groups.get(role) ?? [];
      arr.push(u);
      groups.set(role, arr);
    }
    const sortedRoleKeys = sortAccessModalRoleKeys([...groups.keys()]);
    return sortedRoleKeys.map((role) => {
      const users = groups.get(role) ?? [];
      return {
        role,
        users: [...users].sort((a: AccessUserRow, b: AccessUserRow) =>
          (a.full_name || a.login).localeCompare(b.full_name || b.login, "ru")
        )
      };
    });
  }, [opModalUsers, opUsersModalSearch, opUsersModalShowSelected, opUsersModalSelected]);

  useEffect(() => {
    if (!selectedKey) return;
    /** Ro‘yxat hali kelmagan / refetch bo‘sh — tanlovni o‘chirmaslik (modal yopilmasin). */
    const listPending = tab === "users" ? usersQ.isPending : dimensionsQ.isPending;
    const listFetching = tab === "users" ? usersQ.isFetching : dimensionsQ.isFetching;
    if (listPending) return;
    if (filteredSideRows.length === 0 && listFetching) return;
    if (!filteredSideRows.some((r) => r.key === selectedKey)) setSelectedKey(null);
  }, [
    filteredSideRows,
    selectedKey,
    tab,
    usersQ.isPending,
    usersQ.isFetching,
    dimensionsQ.isPending,
    dimensionsQ.isFetching
  ]);

  useEffect(() => {
    if (!(tab === "users" || tab === "operations")) return;
    setLeftExpandedGroups(new Set());
  }, [tab, leftPanelGroupListSignature]);

  useEffect(() => {
    if (tab !== "operations") {
      setLeftExpandedSubgroups(new Set());
      return;
    }
    setLeftExpandedSubgroups(new Set());
  }, [tab, operationLeftSubgroupStructureSignature]);

  useEffect(() => {
    if (tab === "users") return;
    if (selectedKey) return;
    if (filteredSideRows.length === 0) return;
    startListNavTransition(() => setSelectedKey(filteredSideRows[0]!.key));
  }, [tab, selectedKey, filteredSideRows, startListNavTransition]);

  const activeTabLabel =
    {
      users: "Пользователи",
      operations: "Операции",
      cash_desks: "Кассы",
      warehouses: "Склады",
      branches: "Филиалы",
      payment_methods: "Способы оплаты"
    }[tab] ?? "Пользователи";

  const allVisibleModalUserIds = useMemo(
    () => opModalRoleGroups.flatMap((g: { role: string; users: AccessUserRow[] }) => g.users.map((u: AccessUserRow) => u.id)),
    [opModalRoleGroups]
  );
  const modalRoleKeys = useMemo(() => opModalRoleGroups.map((g) => g.role), [opModalRoleGroups]);
  const allModalGroupsExpanded =
    modalRoleKeys.length > 0 && modalRoleKeys.every((r) => opUsersModalExpandedRoles.has(r));
  const allVisibleModalSelected =
    allVisibleModalUserIds.length > 0 && allVisibleModalUserIds.every((id) => opUsersModalSelected.has(id));
  const allVisibleModalSomeSelected =
    allVisibleModalUserIds.some((id) => opUsersModalSelected.has(id)) && !allVisibleModalSelected;

  const toggleModalRoleExpanded = (role: string) => {
    setOpUsersModalExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const toggleModalSelectAllVisible = (checked: boolean) => {
    setOpUsersModalSelected((prev) => {
      const n = new Set(prev);
      for (const id of allVisibleModalUserIds) {
        if (checked) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  };

  const toggleModalSelectRole = (role: string, checked: boolean) => {
    const group = opModalRoleGroups.find((g) => g.role === role);
    if (!group) return;
    setOpUsersModalSelected((prev) => {
      const n = new Set(prev);
      for (const u of group.users) {
        if (checked) n.add(u.id);
        else n.delete(u.id);
      }
      return n;
    });
  };

  const saveOperationUsersModal = async () => {
    if (!selectedDimension) return;
    if (modalGrantValidationError) return;
    const items = modalBulkItems;
    if (items.length > 0) {
      setAccessBulkSavePending(true);
      try {
        await api.post(`/api/${tenantSlug}/access/users-bulk-patch`, { items });
        invalidateMePermissionsQueries(qc, tenantSlug);
      } finally {
        setAccessBulkSavePending(false);
      }
    }
    setOpUsersModalOpen(false);
    await invalidateAccessWorkspaceCaches();
  };

  const detachScopeUser = async (u: DimensionUserRow) => {
    if (!selectedDimension) return;
    const full = opModalUsersById.get(u.id);
    if (!full) return;
    const kind = tab as ScopeDimensionTab;
    if (!isScopeDimensionTab(kind)) return;
    const body = buildScopeDimensionPatchBody(kind, selectedDimension.key, full, false);
    if (!body) return;
    await operationAccessMut.mutateAsync({ userId: u.id, body });
  };

  const opDimVirtualItems =
    tab === "operations" && displayOperationUsers.length > 0 ? opDimRowVirtualizer.getVirtualItems() : [];
  const opDimPadTop = opDimVirtualItems.length > 0 ? opDimVirtualItems[0].start : 0;
  const opDimPadBot =
    opDimVirtualItems.length > 0
      ? opDimRowVirtualizer.getTotalSize() - opDimVirtualItems[opDimVirtualItems.length - 1].end
      : 0;

  const scopeDimVirtualItems =
    isScopeDimensionTab(tab) && displayCashUsers.length > 0
      ? scopeDimRowVirtualizer.getVirtualItems()
      : [];
  const scopeDimPadTop = scopeDimVirtualItems.length > 0 ? scopeDimVirtualItems[0].start : 0;
  const scopeDimPadBot =
    scopeDimVirtualItems.length > 0
      ? scopeDimRowVirtualizer.getTotalSize() - scopeDimVirtualItems[scopeDimVirtualItems.length - 1].end
      : 0;
  return { tenantSlug, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, opDimUserSort, scopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, scheduleAccessUsersListRefresh, usersQ, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getAccessManagePatchBody, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey, operationRoleFilterItems, operationPositionFilterItems, operationRoleOptions, operationPositionOptions, cashRoleFilterItems, cashPositionFilterItems, cashRoleOptions, cashPositionOptions, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, toggleOpDimUserSort, toggleScopeDimUserSort, modalBulkItems, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimGrantHeaderAllOn, toggleOpDimSelectAllVisible, bulkApplyOpDimAccessManage, bulkApplyOpDimEffective, bulkDetachOpDimSelected, opDimSelectedDetachableCount, scopeDimBulkAllVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks, opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded, allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible, toggleModalSelectRole, saveOperationUsersModal, detachScopeUser, opDimVirtualItems, opDimPadTop, opDimPadBot, scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot, opModalUsersById, opUsersById, opModalUsers } as const;
}
