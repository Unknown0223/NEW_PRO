#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "access");
const bak = fs.readFileSync(path.join(dir, "access-workspace.tsx.bak"), "utf8").split(/\r?\n/);
const L = (a, b) => bak.slice(a - 1, b).join("\n");

const hookHead = `"use client";

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
  type ScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";
`;

const part1Return = `  return {
    tenantSlug, qc,
    search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,
    dimensionUsersApiMissing, setDimensionUsersApiMissing,
    opSearch, setOpSearch,
    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,
    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,
    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions,
    opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities,
    opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,
    cashSearch, setCashSearch,
    cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,
    cashFilterActivitiesDraft, setCashFilterActivitiesDraft,
    cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,
    cashFilterActivities, setCashFilterActivities,
    cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,
    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind,
    opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected,
    opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles,
    leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups,
    accessBulkSavePending, setAccessBulkSavePending,
    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback,
    scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback,
    opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort,
    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,
    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,
    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,
    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,
    rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow,
    groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature,
    selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,
  } as const;`;

const part2Destructure = `  const {
    tenantSlug, qc,
    search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,
    dimensionUsersApiMissing, setDimensionUsersApiMissing,
    opSearch, setOpSearch,
    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,
    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,
    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions,
    opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities,
    opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,
    cashSearch, setCashSearch,
    cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,
    cashFilterActivitiesDraft, setCashFilterActivitiesDraft,
    cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,
    cashFilterActivities, setCashFilterActivities,
    cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,
    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind,
    opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected,
    opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles,
    leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups,
    accessBulkSavePending, setAccessBulkSavePending,
    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback,
    scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback,
    opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort,
    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,
    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,
    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,
    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,
    rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow,
    groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature,
    selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,
  } = ctx;\n\n`;

const part2Return = `  return {
    tenantSlug, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,
    dimensionUsersApiMissing, opSearch, setOpSearch,
    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,
    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,
    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions,
    opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities,
    opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,
    cashSearch, setCashSearch,
    cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,
    cashFilterActivitiesDraft, setCashFilterActivitiesDraft,
    cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,
    cashFilterActivities, setCashFilterActivities,
    cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,
    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind,
    opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected,
    opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles,
    leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups,
    accessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback,
    scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, opDimUserSort, scopeDimUserSort,
    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,
    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,
    scheduleAccessUsersListRefresh, usersQ, dimensionsQ, allUsersForOperationModalQ,
    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,
    rows, selected, startListNavTransition, selectSideRowKey, filteredSideRows, isNestedOperationRow,
    groupedFilteredSideRows, operationNestedGroups, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,
    operationRoleFilterItems, operationPositionFilterItems, operationRoleOptions, operationPositionOptions,
    cashRoleFilterItems, cashPositionFilterItems, cashRoleOptions, cashPositionOptions,
    filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers,
    toggleOpDimUserSort, toggleScopeDimUserSort, modalBulkItems, modalBulkSummaryText, modalGrantValidationError,
    opDimBulkAllVisibleSelected, opDimGrantHeaderAllOn, toggleOpDimSelectAllVisible, bulkApplyOpDimEffective, bulkDetachOpDimSelected,
    scopeDimBulkAllVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks,
    opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded,
    allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible,
    toggleModalSelectRole, saveOperationUsersModal, detachScopeUser,
    opDimVirtualItems, opDimPadTop, opDimPadBot, scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot,
    opModalUsersById, opUsersById, opModalUsers,
  } as const;`;

fs.writeFileSync(
  path.join(dir, "use-access-workspace.part1.ts"),
  `${hookHead}\nexport function useAccessWorkspacePart1({ tenantSlug }: { tenantSlug: string }) {\n${L(421, 849)}\n${part1Return}\n}\n`
);

fs.writeFileSync(
  path.join(dir, "use-access-workspace.part2.ts"),
  `${hookHead}\nimport type { useAccessWorkspacePart1 } from "./use-access-workspace.part1";\n\nexport function useAccessWorkspacePart2(ctx: ReturnType<typeof useAccessWorkspacePart1>) {\n${part2Destructure}${L(851, 1526)}\n${part2Return}\n}\n`
);

fs.writeFileSync(
  path.join(dir, "use-access-workspace.ts"),
  `${hookHead}
import { useAccessWorkspacePart1 } from "./use-access-workspace.part1";
import { useAccessWorkspacePart2 } from "./use-access-workspace.part2";

export type UseAccessWorkspaceReturn = ReturnType<typeof useAccessWorkspacePart2>;

export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  return useAccessWorkspacePart2(useAccessWorkspacePart1({ tenantSlug }));
}
`
);

for (const f of ["use-access-workspace.part1.ts", "use-access-workspace.part2.ts", "use-access-workspace.ts"]) {
  console.log(f, fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).length);
}

for (let i = 3; i <= 5; i++) {
  const p = path.join(dir, `use-access-workspace.part${i}.ts`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
