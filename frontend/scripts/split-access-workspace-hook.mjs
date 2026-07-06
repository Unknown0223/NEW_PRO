#!/usr/bin/env node
/** Regenerate hook part files with 3-way split. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "access");
const lines = fs.readFileSync(path.join(dir, "access-workspace.tsx.bak"), "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const hookImports = `"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TableSortDir } from "@/components/ui/table-sort-button";
import type { SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import {
  ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
  ACCESS_FILTER_MULTI_SEARCH_MIN,
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

const segments = [
  { file: "use-access-workspace.state.ts", fn: "useAccessWorkspaceState", start: 421, end: 699, prev: null },
  { file: "use-access-workspace.dimension.ts", fn: "useAccessWorkspaceDimension", start: 700, end: 1076, prev: "useAccessWorkspaceState" },
  { file: "use-access-workspace.bulk.ts", fn: "useAccessWorkspaceBulk", start: 1077, end: 1526, prev: "useAccessWorkspaceDimension" },
];

for (const seg of segments) {
  const body = slice(seg.start, seg.end);
  const param = seg.prev
    ? `ctx: ReturnType<typeof ${seg.prev}>`
    : `{ tenantSlug }: { tenantSlug: string }`;
  const prelude = seg.prev ? "  const ctx = arguments[0] as ReturnType<typeof " + seg.prev + ">;\n" : "";
  const destructure = seg.prev
    ? `  const {\n    tenantSlug, qc,\n    search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,\n    dimensionUsersApiMissing, setDimensionUsersApiMissing,\n    opSearch, setOpSearch,\n    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,\n    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,\n    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions,\n    opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities,\n    opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,\n    cashSearch, setCashSearch,\n    cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,\n    cashFilterActivitiesDraft, setCashFilterActivitiesDraft,\n    cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,\n    cashFilterActivities, setCashFilterActivities,\n    cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,\n    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind,\n    opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected,\n    opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles,\n    leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups,\n    accessBulkSavePending, setAccessBulkSavePending,\n    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback,\n    scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback,\n    opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort,\n    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,\n    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,\n    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,\n    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,\n    rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow,\n    groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature,\n    selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,\n    operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef,\n    operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems,\n    cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems,\n    filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers,\n    opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById,\n  } = ctx;\n\n`
    : "";

  const importPrev = seg.prev ? `import type { ${seg.prev} } from "./${seg.file.replace(".ts", "")}";\nimport { ${seg.prev} } from "./use-access-workspace.state";\n`.replace("use-access-workspace.state", seg.prev === "useAccessWorkspaceDimension" ? "use-access-workspace.state" : "use-access-workspace.dimension") : "";

  const fixedImport = seg.prev
    ? `import type { ${segments.find((s) => s.fn === seg.prev).fn} } from "./${segments.find((s) => s.fn === seg.prev).file.replace(".ts", "")}";\n`
    : "";

  const content =
    hookImports +
    fixedImport +
    `\nexport function ${seg.fn}(${param}) {\n` +
    destructure +
    body +
    `\n  return { ...ctx${seg.prev ? "" : ""}, tenantSlug, qc, search, setSearch } as any;\n}\n`;

  // Fix return - use spread ctx for non-first segments
  const ret = seg.prev
    ? `\n  return {\n    ...ctx,\n${body.match(/const (\w+) =/g)?.join("") || ""}\n  } as const;\n`
    : "";

  fs.writeFileSync(
    path.join(dir, seg.file),
    hookImports +
      fixedImport +
      `\nexport function ${seg.fn}(${param}) {\n` +
      destructure +
      body +
      (seg.prev ? `\n  return { ...ctx } as typeof ctx;\n}\n` : `\n  return { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } as const;\n}\n`)
  );
  console.log(seg.file, fs.readFileSync(path.join(dir, seg.file), "utf8").split(/\r?\n/).length);
}

// Fix dimension and bulk returns manually via second pass
const stateText = fs.readFileSync(path.join(dir, "use-access-workspace.state.ts"), "utf8");
const dimBody = slice(700, 1076);
const bulkBody = slice(1077, 1526);

fs.writeFileSync(
  path.join(dir, "use-access-workspace.dimension.ts"),
  hookImports +
    `import type { useAccessWorkspaceState } from "./use-access-workspace.state";\n\n` +
    `export function useAccessWorkspaceDimension(ctx: ReturnType<typeof useAccessWorkspaceState>) {\n` +
    `  const {\n    tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,\n    dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch,\n    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,\n    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,\n    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants,\n    opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,\n    cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,\n    cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,\n    cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,\n    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch,\n    opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected,\n    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups,\n    leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending,\n    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel,\n    scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort,\n    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,\n    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,\n    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,\n    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,\n    rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow,\n    groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature,\n    selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,\n  } = ctx;\n\n` +
    dimBody +
    `\n  return {\n    ...ctx,\n    operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef,\n    operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems,\n    cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems,\n    filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers,\n    opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById,\n  } as const;\n}\n`
);

fs.writeFileSync(
  path.join(dir, "use-access-workspace.bulk.ts"),
  hookImports +
    `import type { useAccessWorkspaceDimension } from "./use-access-workspace.dimension";\n\n` +
    `export function useAccessWorkspaceBulk(ctx: ReturnType<typeof useAccessWorkspaceDimension>) {\n` +
    `  const {\n    tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,\n    dimensionUsersApiMissing, opSearch, setOpSearch,\n    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,\n    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,\n    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants,\n    opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,\n    cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,\n    cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,\n    cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,\n    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch,\n    opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected,\n    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups,\n    leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending,\n    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel,\n    scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, scopeDimUserSort,\n    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,\n    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,\n    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,\n    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,\n    rows, selected, startListNavTransition, selectSideRowKey, filteredSideRows, isNestedOperationRow,\n    groupedFilteredSideRows, operationNestedGroups, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,\n    operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef,\n    operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems,\n    cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems,\n    filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers,\n    opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById,\n    setOpDimUserSort, setScopeDimUserSort, setDimensionUsersApiMissing,\n  } = ctx;\n\n` +
    bulkBody +
    `\n  return {\n    tenantSlug, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,\n    dimensionUsersApiMissing, opSearch, setOpSearch,\n    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,\n    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,\n    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants,\n    opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,\n    cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,\n    cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,\n    cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,\n    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch,\n    opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected,\n    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups,\n    leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, opDimBulkSel, setOpDimBulkSel,\n    opDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, opDimUserSort, scopeDimUserSort,\n    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,\n    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,\n    scheduleAccessUsersListRefresh, usersQ, dimensionsQ, allUsersForOperationModalQ,\n    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,\n    rows, selected, startListNavTransition, selectSideRowKey, filteredSideRows, isNestedOperationRow,\n    groupedFilteredSideRows, operationNestedGroups, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,\n    operationRoleFilterItems, operationPositionFilterItems, operationRoleOptions, operationPositionOptions,\n    cashRoleFilterItems, cashPositionFilterItems, cashRoleOptions, cashPositionOptions,\n    filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers,\n    toggleOpDimUserSort, toggleScopeDimUserSort, modalBulkItems, modalBulkSummaryText, modalGrantValidationError,\n    opDimBulkAllVisibleSelected, opDimGrantHeaderAllOn, toggleOpDimSelectAllVisible, bulkApplyOpDimEffective, bulkDetachOpDimSelected,\n    scopeDimBulkAllVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks,\n    opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded,\n    allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible,\n    toggleModalSelectRole, saveOperationUsersModal, detachScopeUser,\n    opDimVirtualItems, opDimPadTop, opDimPadBot, scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot,\n    opModalUsersById, opUsersById, opModalUsers,\n  } as const;\n}\n`
);

// state file - rewrite cleanly
fs.writeFileSync(
  path.join(dir, "use-access-workspace.state.ts"),
  hookImports +
    `\nexport function useAccessWorkspaceState({ tenantSlug }: { tenantSlug: string }) {\n` +
    slice(421, 699) +
    `\n  return {\n    tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,\n    dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch,\n    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,\n    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,\n    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants,\n    opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,\n    cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,\n    cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,\n    cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,\n    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch,\n    opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected,\n    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups,\n    leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending,\n    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel,\n    scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort,\n    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,\n    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,\n    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,\n    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,\n    rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow,\n    groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature,\n    selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey,\n  } as const;\n}\n`
);

fs.writeFileSync(
  path.join(dir, "use-access-workspace.ts"),
  `"use client";

import { useAccessWorkspaceState } from "./use-access-workspace.state";
import { useAccessWorkspaceDimension } from "./use-access-workspace.dimension";
import { useAccessWorkspaceBulk } from "./use-access-workspace.bulk";

export type UseAccessWorkspaceReturn = ReturnType<typeof useAccessWorkspaceBulk>;

export function useAccessWorkspace(props: { tenantSlug: string }) {
  const state = useAccessWorkspaceState(props);
  const dimension = useAccessWorkspaceDimension(state);
  return useAccessWorkspaceBulk(dimension);
}
`
);

for (const f of ["use-access-workspace.state.ts", "use-access-workspace.dimension.ts", "use-access-workspace.bulk.ts", "use-access-workspace.ts"]) {
  console.log(f, fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).length);
}

// remove old files
for (const f of ["use-access-workspace.core.ts", "use-access-workspace.rest.ts"]) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
