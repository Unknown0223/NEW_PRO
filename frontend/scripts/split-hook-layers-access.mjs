#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX = 280;
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "access");
const hookPath = path.join(dir, "use-access-workspace.ts");

function collectDefinedNames(lines) {
  const names = new Set();
  for (const l of lines) {
    let m = l.match(/^\s*const\s+(\w+)\s*=/);
    if (m) names.add(m[1]);
    m = l.match(/^\s*const\s+\[([^\]]+)\]/);
    if (m) {
      for (const part of m[1].split(",")) {
        const n = part.trim().split(":")[0]?.trim();
        if (n && /^\w+$/.test(n)) names.add(n);
      }
    }
    m = l.match(/^\s*function\s+(\w+)\s*\(/);
    if (m) names.add(m[1]);
  }
  return [...names];
}

function splitAtBlank(bodyLines, maxSize) {
  const chunks = [];
  let start = 0;
  while (start < bodyLines.length) {
    if (bodyLines.length - start <= maxSize) {
      chunks.push(bodyLines.slice(start));
      break;
    }
    let end = Math.min(start + maxSize, bodyLines.length);
    while (end > start + 40 && bodyLines[end]?.trim() !== "") end--;
    if (end <= start + 40) end = start + maxSize;
    chunks.push(bodyLines.slice(start, end));
    start = end;
  }
  return chunks;
}

// Regenerate monolithic hook from backup first
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

fs.writeFileSync(
  hookPath,
  `${hookHead}
export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
${L(421, 1526)}
  return {
    tenantSlug, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab,
    dimensionUsersApiMissing, opSearch, setOpSearch,
    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,
    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,
    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants,
    opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,
    cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,
    cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,
    cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,
    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch,
    opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected,
    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups,
    leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, opDimBulkSel, setOpDimBulkSel,
    opDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, opDimUserSort, scopeDimUserSort,
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
  } as const;
}
`
);

const lines = fs.readFileSync(hookPath, "utf8").split(/\r?\n/);
const fnIdx = lines.findIndex((l) => l.includes("export function useAccessWorkspace"));
let returnIdx = -1;
for (let i = lines.length - 1; i > fnIdx; i--) {
  if (/^\s*return\s*\{/.test(lines[i])) {
    returnIdx = i;
    break;
  }
}
const importBlock = lines.slice(0, fnIdx).join("\n");
const body = lines.slice(fnIdx + 1, returnIdx);
const chunks = splitAtBlank(body, MAX);
const layerNames = [];

for (let i = 0; i < chunks.length; i++) {
  const partName = `useAccessWorkspacePart${i + 1}`;
  layerNames.push(partName);
  const defined = collectDefinedNames(chunks[i]);
  const keys = defined.map((k) => `    ${k},`).join("\n");
  const propsParam = i === 0 ? `{ tenantSlug }: { tenantSlug: string }` : `prev: ReturnType<typeof ${layerNames[i - 1]}>`;
  const partImports =
    i === 0
      ? importBlock
      : `${importBlock}\nimport { ${layerNames[i - 1]} } from "./use-access-workspace.part${i}";`;
  const prelude =
    i === 0
      ? ""
      : `  const ctx = prev;\n  const {\n    tenantSlug, tab, search, setSearch, status, setStatus, selectedKey, setSelectedKey, setTab,\n    dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch,\n    opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft,\n    opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft,\n    opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants,\n    opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch,\n    cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft,\n    cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions,\n    cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch,\n    opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch,\n    opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected,\n    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups,\n    leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending,\n    opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel,\n    scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort,\n    opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef,\n    dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll,\n    invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ,\n    toggleMut, resetMut, operationAccessMut, opDimAccessBusyUserId, getOpEffective, getOpPatchBodyForToggle,\n    rows, selected, startListNavTransition, selectSideRowKey, sideRows, filteredSideRows, isNestedOperationRow,\n    groupedFilteredSideRows, operationNestedGroups, leftPanelGroupListSignature, operationLeftSubgroupStructureSignature,\n    selectedDimension, dimensionUsersQ, prefetchDimensionUsersForKey, operationUsers, cashUsers, opModalUsers, opModalUsersById,\n    operationUsersModalRef, operationRoleOptions, operationPositionOptions, operationRoleFilterItems, operationPositionFilterItems,\n    cashRoleOptions, cashPositionOptions, cashRoleFilterItems, cashPositionFilterItems, filteredOperationUsers, filteredCashUsers,\n    displayOperationUsers, displayCashUsers, opDimRowVirtualizer, scopeDimRowVirtualizer, toggleOpDimUserSort, toggleScopeDimUserSort, opUsersById,\n    modalBulkItems, scopeModalSkippedAttachNoManage, modalBulkSummaryText, modalGrantValidationError,\n    opDimBulkAllVisibleSelected, opDimBulkSomeVisibleSelected, opDimGrantHeaderAllOn, opDimGrantHeaderSomeOn,\n    toggleOpDimSelectAllVisible, postOpDimBulkPatch, bulkApplyOpDimEffective, bulkDetachOpDimSelected, isScopeDimensionTab,\n    scopeDimBulkAllVisibleSelected, scopeDimBulkSomeVisibleSelected, toggleScopeDimSelectAllVisible, bulkDetachScopeDimLinks,\n    opModalRoleGroups, activeTabLabel, allVisibleModalUserIds, modalRoleKeys, allModalGroupsExpanded,\n    allVisibleModalSelected, allVisibleModalSomeSelected, toggleModalRoleExpanded, toggleModalSelectAllVisible,\n    toggleModalSelectRole, saveOperationUsersModal, detachScopeUser, opDimVirtualItems, opDimPadTop, opDimPadBot,\n    scopeDimVirtualItems, scopeDimPadTop, scopeDimPadBot,\n  } = ctx;\n\n`;

  const returnSpread = i === 0 ? "" : "    ...prev,\n";
  fs.writeFileSync(
    path.join(dir, `use-access-workspace.part${i + 1}.ts`),
    `${partImports}\nexport function ${partName}(${propsParam}) {\n${prelude}${chunks[i].join("\n")}\n\n  return {\n${returnSpread}${keys}\n  } as const;\n}\n`
  );
  console.log(`part${i + 1}`, fs.readFileSync(path.join(dir, `use-access-workspace.part${i + 1}.ts`), "utf8").split(/\r?\n/).length);
}

const compose = `${importBlock}
${layerNames.map((n, i) => `import { ${n} } from "./use-access-workspace.part${i + 1}";`).join("\n")}

export type UseAccessWorkspaceReturn = ReturnType<typeof ${layerNames[layerNames.length - 1]}>;

export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
${layerNames.map((n, i) => `  const l${i + 1} = ${n}(${i === 0 ? "{ tenantSlug }" : `l${i}`});`).join("\n")}
  return l${layerNames.length};
}
`;
fs.writeFileSync(hookPath, compose);
console.log("use-access-workspace.ts", compose.split(/\r?\n/).length);
