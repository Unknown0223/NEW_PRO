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

const segments = [
  { name: "useAccessWorkspacePart1", file: "use-access-workspace.part1.ts", start: 421, end: 699, prev: null },
  { name: "useAccessWorkspacePart2", file: "use-access-workspace.part2.ts", start: 700, end: 849, prev: "useAccessWorkspacePart1" },
  { name: "useAccessWorkspacePart3", file: "use-access-workspace.part3.ts", start: 851, end: 1200, prev: "useAccessWorkspacePart2" },
  { name: "useAccessWorkspacePart4", file: "use-access-workspace.part4.ts", start: 1201, end: 1526, prev: "useAccessWorkspacePart3" },
];

const ctxFields = `tenantSlug, qc,
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
    operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef,
    operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems,
    cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems,
    filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers,
    opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById,
    modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError,
    opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn,
    toggleOpDimSelectAllVisible, postOpDimBulkPatch, bulkApplyOpDimEffective, bulkDetachOpDimSelected, isScopeDimensionTab,
    scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks,
    opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded,
    allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible,
    toggleModalSelectRole, saveOperationUsersModal, detachScopeUser, opDimVirtualItems, opDimPadTop, opDimPadBot,
    scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot`;

for (const seg of segments) {
  const param = seg.prev ? `ctx: ReturnType<typeof ${seg.prev}>` : `{ tenantSlug }: { tenantSlug: string }`;
  const importPrev = seg.prev ? `\nimport type { ${seg.prev} } from "./${segments.find((s) => s.name === seg.prev).file.replace(".ts", "")}";\n` : "";
  const prelude = seg.prev ? `  const { ${ctxFields} } = ctx;\n\n` : "";
  const body = L(seg.start, seg.end);
  const ret = seg.name === "useAccessWorkspacePart4"
    ? `  return {
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
  } as const;`
    : `  return { ...ctx${seg.prev ? "" : ""}, ${seg.name === "useAccessWorkspacePart1" ? "tenantSlug, " : ""}${body.match(/const \[?(\w+)/g)?.slice(0,5).join("") || "/* see chain */"} } as typeof ctx;`;

  // part 1-3 return spread ctx + new bindings - use simple spread for intermediate
  const intermediateReturn =
    seg.name === "useAccessWorkspacePart4"
      ? ret
      : `  return { ...${seg.prev ? "ctx" : "{}"}, ${seg.prev ? "" : "tenantSlug, "}/* part output */ } as any;`;

  // Simpler: all intermediate parts return { ...ctx, ...newVars } - use spread ctx only and rely on compose
  const content =
    seg.name === "useAccessWorkspacePart4"
      ? `${hookHead}${importPrev}\nexport function ${seg.name}(${param}) {\n${prelude}${body}\n${ret}\n}\n`
      : `${hookHead}${importPrev}\nexport function ${seg.name}(${param}) {\n${prelude}${body}\n  return { ...${seg.prev ? "ctx" : "{ tenantSlug }"}, tenantSlug } as typeof ${seg.prev ? "ctx" : "{ tenantSlug: string }"};\n}\n`;

  // Fix intermediate returns properly - chain merge in compose instead
  fs.writeFileSync(
    path.join(dir, seg.file),
    seg.name === "useAccessWorkspacePart4"
      ? `${hookHead}${importPrev}\nexport function ${seg.name}(${param}) {\n${prelude}${body}\n${ret}\n}\n`
      : `${hookHead}${importPrev}\nexport function ${seg.name}(${param}) {\n${prelude}${body}\n  return { ...${seg.prev ? "ctx" : "{}"}, tenantSlug${seg.prev ? "" : ""} } as ${seg.prev ? "typeof ctx" : "{ tenantSlug: string }"};\n}\n`
  );
}

// Fix parts 1-3 to return merged context - rewrite with explicit approach: only part4 has final return, parts 1-3 accumulate via Object.assign pattern

// Rewrite using working 2-part that passed typecheck, split part2 only
fs.writeFileSync(
  path.join(dir, "use-access-workspace.part1.ts"),
  `${hookHead}\nexport function useAccessWorkspacePart1({ tenantSlug }: { tenantSlug: string }) {\n${L(421, 699)}\n  return { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows } as const;\n}\n`
);

const destructure = `  const { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows } = ctx;\n\n`;

fs.writeFileSync(
  path.join(dir, "use-access-workspace.part2.ts"),
  `${hookHead}\nimport type { useAccessWorkspacePart1 } from "./use-access-workspace.part1";\n\nexport function useAccessWorkspacePart2(ctx: ReturnType<typeof useAccessWorkspacePart1>) {\n${destructure}${L(700, 849)}\n  return { ...ctx, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } as const;\n}\n`
);

const destructure2 = destructure + `  const { filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } = ctx;\n\n`;

fs.writeFileSync(
  path.join(dir, "use-access-workspace.part3.ts"),
  `${hookHead}\nimport type { useAccessWorkspacePart2 } from "./use-access-workspace.part2";\n\nexport function useAccessWorkspacePart3(ctx: ReturnType<typeof useAccessWorkspacePart2>) {\n${destructure2}${L(851, 1200)}\n  return { ...ctx, operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById, modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn, toggleOpDimSelectAllVisible, postOpDimBulkPatch, bulkApplyOpDimEffective, bulkDetachOpDimSelected, isScopeDimensionTab, scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks, opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded, allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible, toggleModalSelectRole, saveOperationUsersModal } as const;\n}\n`
);

const destructure3 = destructure2 + `  const { operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById, modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn, toggleOpDimSelectAllVisible, postOpDimBulkPatch, bulkApplyOpDimEffective, bulkDetachOpDimSelected, isScopeDimensionTab, scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks, opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded, allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible, toggleModalSelectRole, saveOperationUsersModal } = ctx;\n\n`;

fs.writeFileSync(
  path.join(dir, "use-access-workspace.part4.ts"),
  `${hookHead}\nimport type { useAccessWorkspacePart3 } from "./use-access-workspace.part3";\n\nexport function useAccessWorkspacePart4(ctx: ReturnType<typeof useAccessWorkspacePart3>) {\n${destructure3}${L(1201, 1526)}\n  return { tenantSlug, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, opDimUserSort, scopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, scheduleAccessUsersListRefresh, usersQ, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey, operationRoleFilterItems, operationPositionFilterItems, operationRoleOptions, operationPositionOptions, cashRoleFilterItems, cashPositionFilterItems, cashRoleOptions, cashPositionOptions, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, toggleOpDimUserSort, toggleScopeDimUserSort, modalBulkItems, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimGrantHeaderAllOn, toggleOpDimSelectAllVisible, bulkApplyOpDimEffective, bulkDetachOpDimSelected, scopeDimBulkAllVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks, opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded, allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible, toggleModalSelectRole, saveOperationUsersModal, detachScopeUser, opDimVirtualItems, opDimPadTop, opDimPadBot, scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot, opModalUsersById, opUsersById, opModalUsers } as const;\n}\n`
);

fs.writeFileSync(
  path.join(dir, "use-access-workspace.ts"),
  `${hookHead}
import { useAccessWorkspacePart1 } from "./use-access-workspace.part1";
import { useAccessWorkspacePart2 } from "./use-access-workspace.part2";
import { useAccessWorkspacePart3 } from "./use-access-workspace.part3";
import { useAccessWorkspacePart4 } from "./use-access-workspace.part4";

export type UseAccessWorkspaceReturn = ReturnType<typeof useAccessWorkspacePart4>;

export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  return useAccessWorkspacePart4(useAccessWorkspacePart3(useAccessWorkspacePart2(useAccessWorkspacePart1({ tenantSlug }))));
}
`
);

for (const f of ["use-access-workspace.part1.ts", "use-access-workspace.part2.ts", "use-access-workspace.part3.ts", "use-access-workspace.part4.ts", "use-access-workspace.ts"]) {
  console.log(f, fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).length);
}
for (let i = 5; i <= 10; i++) {
  const p = path.join(dir, `use-access-workspace.part${i}.ts`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
