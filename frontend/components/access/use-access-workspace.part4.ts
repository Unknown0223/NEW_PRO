"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TableSortDir } from "@/components/ui/table-sort-button";
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
  isScopeDimensionTab,
  type ScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";

import type { useAccessWorkspacePart3 } from "./use-access-workspace.part3";

export function useAccessWorkspacePart4(ctx: ReturnType<typeof useAccessWorkspacePart3>) {
  const { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } = ctx;

  const { operationAccessMut, opDimAccessBusyUserId, getOpEffective, getAccessManagePatchBody, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } = ctx;

  const { operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer } = ctx;

  const toggleOpDimUserSort = (key: DimUserSortKey) => {
    setOpDimUserSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const toggleScopeDimUserSort = (key: DimUserSortKey) => {
    setScopeDimUserSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const opUsersById = useMemo(() => {
    const m = new Map<number, DimensionUserRow>();
    for (const u of operationUsers) m.set(u.id, u);
    return m;
  }, [operationUsers]);

  type AccessBulkItem = Record<string, unknown> & { user_id: number };

  const { modalBulkItems, scopeModalSkippedAttachNoManage } = useMemo(() => {
    if (!opUsersModalOpen || !selectedDimension) {
      return { modalBulkItems: [] as AccessBulkItem[], scopeModalSkippedAttachNoManage: 0 };
    }
    if (usersModalKind === "operations") {
      const items: AccessBulkItem[] = [];
      const permissionKey = selectedDimension.key;
      for (const u of opModalUsers) {
        const want = opUsersModalSelected.has(u.id);
        const existing = opUsersById.get(u.id);
        if (!existing) {
          if (want) {
            items.push({
              user_id: u.id,
              merge_permissions: true,
              permissions: [permissionKey],
              denied_permissions: []
            });
          }
          continue;
        }
        const body = getOpPatchBodyForToggle(existing, want, permissionKey);
        if (!body) continue;
        items.push({ user_id: u.id, ...body });
      }
      return { modalBulkItems: items, scopeModalSkippedAttachNoManage: 0 };
    }
    const kind = usersModalKind as ScopeDimensionTab;
    const { items, skippedAttachNoAccessManage } = collectScopeDimensionModalBulkItems(
      kind,
      selectedDimension.key,
      opModalUsers,
      opUsersModalSelected
    );
    return { modalBulkItems: items, scopeModalSkippedAttachNoManage: skippedAttachNoAccessManage };
  }, [opUsersModalOpen, selectedDimension, usersModalKind, opModalUsers, opUsersModalSelected, opUsersById, getOpPatchBodyForToggle]);

  const modalBulkSummaryText = useMemo(() => {
    if (!opUsersModalOpen || !selectedDimension) return "";
    const n = modalBulkItems.length;
    if (n === 0) {
      if (usersModalKind === "operations") {
        return "Нет отличий от текущего доступа: сохранять нечего.";
      }
      if (scopeModalSkippedAttachNoManage > 0) {
        return `Для ${scopeModalSkippedAttachNoManage} пользов. не применено: «выдавать склад другим» возможно только с «Доступ: управление» (access.manage). Остальные привязки уже совпадают с текущими.`;
      }
      return "Нет отличий от текущих привязок к объекту: сохранять нечего.";
    }
    return `К записи одним запросом на сервер: ${n} ${n === 1 ? "пользователь" : "пользователей"}.`;
  }, [
    opUsersModalOpen,
    selectedDimension,
    usersModalKind,
    modalBulkItems.length,
    scopeModalSkippedAttachNoManage
  ]);

  useEffect(() => {
    setOpDimBulkSel((prev) => {
      if (prev.size === 0) return prev;
      const vis = new Set(filteredOperationUsers.map((u) => u.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (vis.has(id)) next.add(id);
      }
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [filteredOperationUsers]);

  useEffect(() => {
    if (!opDimBulkFeedback) return;
    const t = window.setTimeout(() => setOpDimBulkFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [opDimBulkFeedback]);

  const opDimBulkAllVisibleSelected =
    filteredOperationUsers.length > 0 && filteredOperationUsers.every((u) => opDimBulkSel.has(u.id));
  const opDimBulkSomeVisibleSelected =
    filteredOperationUsers.some((u) => opDimBulkSel.has(u.id)) && !opDimBulkAllVisibleSelected;

  useEffect(() => {
    const el = opDimBulkHeaderCheckboxRef.current;
    if (el) el.indeterminate = opDimBulkSomeVisibleSelected;
  }, [opDimBulkSomeVisibleSelected]);

  const opDimGrantHeaderAllOn =
    filteredOperationUsers.length > 0 && filteredOperationUsers.every((u) => u.has_access_manage);
  const opDimGrantHeaderSomeOn =
    filteredOperationUsers.some((u) => u.has_access_manage) && !opDimGrantHeaderAllOn;

  useEffect(() => {
    const el = opDimGrantHeaderSwitchRef.current;
    if (el) el.indeterminate = opDimGrantHeaderSomeOn;
  }, [opDimGrantHeaderSomeOn]);

  const toggleOpDimSelectAllVisible = (checked: boolean) => {
    if (checked) setOpDimBulkSel(new Set(filteredOperationUsers.map((u) => u.id)));
    else setOpDimBulkSel(new Set());
  };

  const postOpDimBulkPatch = async (items: Array<Record<string, unknown> & { user_id: number }>): Promise<boolean> => {
    if (items.length === 0) return false;
    setAccessBulkSavePending(true);
    try {
      await api.post(`/api/${tenantSlug}/access/users-bulk-patch`, { items });
      await invalidateAccessWorkspaceCaches();
      setOpDimBulkSel(new Set());
      setScopeDimBulkSel(new Set());
      return true;
    } catch {
      return false;
    } finally {
      setAccessBulkSavePending(false);
    }
  };

  const bulkApplyOpDimAccessManage = async (wantManage: boolean) => {
    if (!selectedDimension || tab !== "operations") return;
    const hadRowSelection = opDimBulkSel.size > 0;
    const targets = hadRowSelection ? filteredOperationUsers.filter((u) => opDimBulkSel.has(u.id)) : filteredOperationUsers;
    const items: Array<Record<string, unknown> & { user_id: number }> = [];
    for (const u of targets) {
      const body = getAccessManagePatchBody(u, wantManage);
      if (body) items.push({ user_id: u.id, ...body });
    }
    if (items.length === 0) {
      setOpDimBulkFeedback({ tone: "ok", text: "Изменений не требуется" });
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setOpDimBulkFeedback({
        tone: "ok",
        text: wantManage
          ? hadRowSelection
            ? `Право выдавать доступ включено для выбранных (${items.length})`
            : `Право выдавать доступ включено для всех видимых (${items.length})`
          : hadRowSelection
            ? `Право выдавать доступ снято для выбранных (${items.length})`
            : `Право выдавать доступ снято для всех видимых (${items.length})`
      });
    } else {
      setOpDimBulkFeedback({ tone: "err", text: "Не удалось применить массово" });
    }
  };

  const bulkApplyOpDimEffective = async (wantEffective: boolean) => {
    if (!selectedDimension || tab !== "operations") return;
    const key = selectedDimension.key;
    const hadRowSelection = opDimBulkSel.size > 0;
    const targets = hadRowSelection ? filteredOperationUsers.filter((u) => opDimBulkSel.has(u.id)) : filteredOperationUsers;
    const items: Array<Record<string, unknown> & { user_id: number }> = [];
    for (const u of targets) {
      const body = getOpPatchBodyForToggle(u, wantEffective, key);
      if (body) items.push({ user_id: u.id, ...body });
    }
    if (items.length === 0) {
      setOpDimBulkFeedback({ tone: "ok", text: "Изменений не требуется" });
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setOpDimBulkFeedback({
        tone: "ok",
        text: wantEffective
          ? hadRowSelection
            ? `Доступ разрешён для выбранных (${items.length}), одним запросом`
            : `Доступ разрешён для всех видимых (${items.length}), одним запросом`
          : hadRowSelection
            ? `Доступ изменён для выбранных (${items.length}), одним запросом`
            : `Доступ изменён для всех видимых (${items.length}), одним запросом`
      });
    } else {
      setOpDimBulkFeedback({ tone: "err", text: "Не удалось применить массово" });
    }
  };

  const bulkDetachOpDimSelected = async () => {
    if (!selectedDimension || tab !== "operations") return;
    const key = selectedDimension.key;
    const targets = filteredOperationUsers.filter((u) => opDimBulkSel.has(u.id) && getOpEffective(u));
    const items: Array<Record<string, unknown> & { user_id: number }> = [];
    for (const u of targets) {
      if (u.from_direct_allow || u.from_direct_deny) {
        items.push({ user_id: u.id, remove_permission_keys: [key] });
      } else {
        const body = getOpPatchBodyForToggle(u, false, key);
        if (body) items.push({ user_id: u.id, ...body });
      }
    }
    if (items.length === 0) {
      setOpDimBulkFeedback({
        tone: "ok",
        text: "Среди выбранных нет активных операций для снятия"
      });
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setOpDimBulkFeedback({ tone: "ok", text: `Снято доступов: ${items.length} (только для выбранных пользователей)` });
    } else {
      setOpDimBulkFeedback({ tone: "err", text: "Не удалось открепить" });
    }
  };

  const opDimSelectedDetachableCount = useMemo(
    () =>
      filteredOperationUsers.filter((u) => opDimBulkSel.has(u.id) && getOpEffective(u)).length,
    [filteredOperationUsers, opDimBulkSel, getOpEffective]
  );

  const isScopeDimensionTabCheck = (t: typeof tab): t is ScopeDimensionTab => isScopeDimensionTab(t);

  /** Modal: предупреждение только если реально есть что сохранять и в payload есть выдача операции без `access.manage`. */
  const modalGrantValidationError = useMemo((): string | null => null, []);

  useEffect(() => {
    setScopeDimBulkSel((prev) => {
      if (prev.size === 0) return prev;
      const vis = new Set(filteredCashUsers.map((u) => u.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (vis.has(id)) next.add(id);
      }
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [filteredCashUsers]);

  useEffect(() => {
    if (!scopeDimBulkFeedback) return;
    const t = window.setTimeout(() => setScopeDimBulkFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [scopeDimBulkFeedback]);

  const scopeDimBulkAllVisibleSelected =
    filteredCashUsers.length > 0 && filteredCashUsers.every((u) => scopeDimBulkSel.has(u.id));
  const scopeDimBulkSomeVisibleSelected =
    filteredCashUsers.some((u) => scopeDimBulkSel.has(u.id)) && !scopeDimBulkAllVisibleSelected;

  useEffect(() => {
    const el = scopeDimBulkHeaderCheckboxRef.current;
    if (el) el.indeterminate = scopeDimBulkSomeVisibleSelected;
  }, [scopeDimBulkSomeVisibleSelected]);

  const toggleScopeDimSelectAllVisible = (checked: boolean) => {
    if (checked) setScopeDimBulkSel(new Set(filteredCashUsers.map((u) => u.id)));
    else setScopeDimBulkSel(new Set());
  };

  /** Снять привязку к кассе / складу / филиалу / способу оплаты (как «запрет» в операциях). */
  const bulkDetachScopeDimLinks = async () => {
    if (!selectedDimension || !isScopeDimensionTabCheck(tab)) return;
    const kind = tab;
    const hadRowSelection = scopeDimBulkSel.size > 0;
    const targets = hadRowSelection ? filteredCashUsers.filter((u) => scopeDimBulkSel.has(u.id)) : filteredCashUsers;
    const items: Array<Record<string, unknown> & { user_id: number }> = [];
    for (const u of targets) {
      const full = opModalUsersById.get(u.id);
      if (!full) continue;
      const body = buildScopeDimensionPatchBody(kind, selectedDimension.key, full, false);
      if (!body) continue;
      items.push({ user_id: u.id, ...body });
    }
    if (items.length === 0) {
      setScopeDimBulkFeedback({
        tone: "ok",
        text: opModalUsers.length === 0 ? "Загрузка списка пользователей…" : "Изменений не требуется"
      });
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setScopeDimBulkFeedback({
        tone: "ok",
        text: hadRowSelection
          ? `Откреплено выбранных: ${items.length}, одним запросом`
          : `Откреплено всех видимых: ${items.length}, одним запросом`
      });
    } else {
      setScopeDimBulkFeedback({ tone: "err", text: "Не удалось применить массово" });
    }
  };
  return { ...ctx, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById, modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn, toggleOpDimSelectAllVisible, bulkApplyOpDimAccessManage, bulkApplyOpDimEffective, bulkDetachOpDimSelected, opDimSelectedDetachableCount, isScopeDimensionTab: isScopeDimensionTabCheck, scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks } as const;
}
