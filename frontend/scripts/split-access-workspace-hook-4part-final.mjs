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
  type OpAccessMutCtx,
  type ScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";
`;

const ctxA = `  const { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } = ctx;\n\n`;

const ctxB = ctxA + `  const { operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } = ctx;\n\n`;

const ctxC = ctxB + `  const { operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer } = ctx;\n\n`;

const retA = `  return { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } as const;`;

const retB = `  return { ...ctx, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey } as const;`;

const retC = `  return { ...ctx, operationUsers, cashUsers, opModalUsers, opModalUsersById, operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems, cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer } as const;`;

const ctxD = ctxC + `  const { toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById, modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn, toggleOpDimSelectAllVisible, bulkApplyOpDimEffective, bulkDetachOpDimSelected, isScopeDimensionTab, scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks } = ctx;\n\n`;

const retE = `  return { ...ctx, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById, modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn, toggleOpDimSelectAllVisible, bulkApplyOpDimEffective, bulkDetachOpDimSelected, isScopeDimensionTab, scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks } as const;`;

const retD = `  return { tenantSlug, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, opDimUserSort, scopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, scheduleAccessUsersListRefresh, usersQ, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle, rows, selected, startListNavTransition, selectSideRowKey, filteredSideRows, isNestedOperationRow, groupedFilteredSideRows, operationNestedGroups, selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey, operationRoleFilterItems, operationPositionFilterItems, operationRoleOptions, operationPositionOptions, cashRoleFilterItems, cashPositionFilterItems, cashRoleOptions, cashPositionOptions, filteredOperationUsers, filteredCashUsers, displayOperationUsers, displayCashUsers, toggleOpDimUserSort, toggleScopeDimUserSort, modalBulkItems, modalBulkSummaryText, modalGrantValidationError, opDimBulkAllVisibleSelected, opDimGrantHeaderAllOn, toggleOpDimSelectAllVisible, bulkApplyOpDimEffective, bulkDetachOpDimSelected, scopeDimBulkAllVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks, opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded, allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible, toggleModalSelectRole, saveOperationUsersModal, detachScopeUser, opDimVirtualItems, opDimPadTop, opDimPadBot, scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot, opModalUsersById, opUsersById, opModalUsers } as const;`;

fs.writeFileSync(path.join(dir, "use-access-workspace.part1.ts"), `${hookHead}\nexport function useAccessWorkspacePart1({ tenantSlug }: { tenantSlug: string }) {\n${L(421, 601)}\n${retA}\n}\n`);
fs.writeFileSync(path.join(dir, "use-access-workspace.part2.ts"), `${hookHead}\nimport type { useAccessWorkspacePart1 } from "./use-access-workspace.part1";\n\nexport function useAccessWorkspacePart2(ctx: ReturnType<typeof useAccessWorkspacePart1>) {\n${ctxA}${L(602, 849)}\n${retB}\n}\n`);
fs.writeFileSync(path.join(dir, "use-access-workspace.part3.ts"), `${hookHead}\nimport type { useAccessWorkspacePart2 } from "./use-access-workspace.part2";\n\nexport function useAccessWorkspacePart3(ctx: ReturnType<typeof useAccessWorkspacePart2>) {\n${ctxB}${L(851, 1076)}\n${retC}\n}\n`);
fs.writeFileSync(path.join(dir, "use-access-workspace.part4.ts"), `${hookHead}\nimport type { useAccessWorkspacePart3 } from "./use-access-workspace.part3";\n\nexport function useAccessWorkspacePart4(ctx: ReturnType<typeof useAccessWorkspacePart3>) {\n${ctxC}${L(1077, 1375)}\n${retE}\n}\n`);
fs.writeFileSync(path.join(dir, "use-access-workspace.part5.ts"), `${hookHead}\nimport type { useAccessWorkspacePart4 } from "./use-access-workspace.part4";\n\nexport function useAccessWorkspacePart5(ctx: ReturnType<typeof useAccessWorkspacePart4>) {\n${ctxD}${L(1377, 1526)}\n${retD}\n}\n`);
fs.writeFileSync(path.join(dir, "use-access-workspace.ts"), `${hookHead}
import { useAccessWorkspacePart1 } from "./use-access-workspace.part1";
import { useAccessWorkspacePart2 } from "./use-access-workspace.part2";
import { useAccessWorkspacePart3 } from "./use-access-workspace.part3";
import { useAccessWorkspacePart4 } from "./use-access-workspace.part4";
import { useAccessWorkspacePart5 } from "./use-access-workspace.part5";

export type UseAccessWorkspaceReturn = ReturnType<typeof useAccessWorkspacePart5>;

export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  return useAccessWorkspacePart5(useAccessWorkspacePart4(useAccessWorkspacePart3(useAccessWorkspacePart2(useAccessWorkspacePart1({ tenantSlug })))));
}
`);

for (const f of ["use-access-workspace.part1.ts", "use-access-workspace.part2.ts", "use-access-workspace.part3.ts", "use-access-workspace.part4.ts", "use-access-workspace.part5.ts", "use-access-workspace.ts"]) {
  console.log(f, fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).length);
}
