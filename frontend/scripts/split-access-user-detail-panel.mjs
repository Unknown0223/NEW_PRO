#!/usr/bin/env node
/** access-user-detail-panel: types / hook / tabs / modals. */
import fs, { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const panelDir = path.join(root, "components/access/access-user-detail");
const srcPath = path.join(root, "components/access/access-user-detail-panel.tsx");
const monolithPath = path.join(panelDir, "access-user-detail-panel.monolith.tsx");

mkdirSync(path.join(panelDir, "hooks"), { recursive: true });
if (!fs.existsSync(monolithPath)) {
  copyFileSync(srcPath, monolithPath);
}
const lines = readFileSync(monolithPath, "utf8").split(/\r?\n/);

const clientImports = lines.slice(0, 49).join("\n");

// types + pure utils (no React components)
const typesBlock = lines.slice(50, 348).join("\n");
const utilsTail = lines.slice(481, 554).join("\n");

function addExports(block) {
  return block
    .replace(/^type /gm, "export type ")
    .replace(/^function /gm, "export function ")
    .replace(/^const STAFF_ROLE_ORDER/gm, "export const STAFF_ROLE_ORDER");
}

writeFileSync(
  path.join(panelDir, "access-user-detail.types.ts"),
  `${addExports(typesBlock)}

${addExports(utilsTail)}

export type AccessUserAccountControls = {
  isActive: boolean;
  onToggle: () => void;
  onReset: (userId: number) => void | Promise<void>;
  togglePending: boolean;
  resetPending: boolean;
};
`
);

writeFileSync(
  path.join(panelDir, "access-user-detail-territory-ui.tsx"),
  `"use client";

import { useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AccessTerritoryTreeNode,
  collectSubtreeTerritoryIdStrings,
  sortedTerritoryTreeLevel
} from "./access-user-detail.types";

export ${lines.slice(348, 383).join("\n").replace(/^function /, "function ")}

export ${lines.slice(384, 480).join("\n").replace(/^function /, "function ")}
`
);

const hookBody = [...lines.slice(576, 1326), ...lines.slice(1333, 1374)].join("\n");
writeFileSync(
  path.join(panelDir, "hooks/use-access-user-detail-panel.ts"),
  `"use client";

${clientImports}
import {
  normalizeAccessGrantPermissions,
  buildGrantDelegationPatchBody,
  chunkGrantDelegationPatchBodies,
  parseGrantDelegationPatch,
  grantDelegationKeysNeedingChange,
  applyGrantDelegationDetailCache
} from "@/components/access/access-workspace.shared";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import {
  isGrantedMatrixRow,
  isMatrixRowBulkSelectable,
  matchesPermissionSourceFilter,
  permissionSourceLabel
} from "@/lib/access-user-permission-matrix";
import {
  type MatrixRow,
  type ModalPickRow,
  type DetailResponse,
  type DimRow,
  type TerritoryApiRow,
  type SupervisorPickRow,
  type AccessTerritoriesCatalog,
  type InnerTab,
  type MatrixSortKey,
  userMessageAfterAccessPatchFailure,
  compareMatrixRows,
  matrixCollator,
  buildBulkEffectivePatchBody,
  shortenPathLabel,
  staffRoleGroupLabel,
  uniqRoleKeys,
  sortStaffRoleKeys,
  formatStaffPickLine,
  buildTerritoryHierarchy,
  territoryLeafNameOnly,
  formatTerritoryAssigneeSubtitle,
  territoryZoneLabel,
  patchTouchesUserDirectory
} from "../access-user-detail.types";
import { type AccessUserAccountControls } from "../access-user-detail.types";

export type AccessUserDetailVm = ReturnType<typeof useAccessUserDetailPanel>;

export function useAccessUserDetailPanel({
  tenantSlug,
  userId,
  onInvalidateUsers,
  userAccountControls
}: {
  tenantSlug: string;
  userId: number;
  onInvalidateUsers: () => void;
  userAccountControls?: AccessUserAccountControls | null;
}) {
${hookBody}
  return {
    tenantSlug,
    userId,
    userAccountControls,
    inner,
    setInner,
    tableSearch,
    setTableSearch,
    modal,
    setModal,
    innerTabs,
    modalTitle,
    assignPickModal,
    modalUserLabel,
    user,
    openModal,
    patchMut,
    detailQ,
    catalogQ,
    territoriesQ,
    dimQ,
    supervisorPickQ,
    filterParentDraft,
    setFilterParentDraft,
    filterSourceDraft,
    setFilterSourceDraft,
    setFilterParent,
    setFilterSource,
    matrixRowGroups,
    matrixGroupsAllExpanded,
    toggleMatrixGroupsExpandCollapse,
    parentOptions,
    bulkFeedback,
    userAccountControls: userAccountControls ?? null,
    bulkSel,
    setBulkSel,
    bulkSelectableKeys,
    bulkHeaderCheckboxRef,
    bulkHeaderAllSelected,
    toggleBulkAll,
    matrixHeadScrollRef,
    matrixBodyScrollRef,
    onMatrixHeadScroll,
    onMatrixBodyScroll,
    matrixSort,
    toggleMatrixSort,
    grantHeaderSwitchRef,
    grantHeaderAllOn,
    bulkApplyGrantDelegation,
    tableMatrix,
    matrixGroupExpanded,
    setMatrixGroupExpanded,
    isRowBulkSelectable,
    toggleBulkGroup,
    toggleRowGrantDelegation,
    selectedDetachableCount,
    bulkApplyFilteredEffective,
    bulkDetach,
    modalSearch,
    setModalSearch,
    showSelOnly,
    setShowSelOnly,
    modalSel,
    setModalSel,
    attachModalBaseItems,
    opAttachGroups,
    opAttachGroupKeys,
    allOpAttachGroupsExpanded,
    setOpAttachGroupExpanded,
    toggleOpAttachGroup,
    territoryCatalog,
    visibleTerritoryLeafKeys,
    useReferenceTerritoryTree,
    referenceTerritoryTree,
    territoryHierarchy,
    territoryExpanded,
    setTerritoryExpanded,
    territorySubExpanded,
    setTerritorySubExpanded,
    treeExpanded,
    setTreeExpanded,
    staffPickByRole,
    staffRoleExpanded,
    setStaffRoleExpanded,
    toggleExpandCollapseStaffRoles,
    allStaffGroupsInViewExpanded,
    staffPickBootstrapping,
    visibleStaffPickIds,
    filteredModalItems,
    dimPickModal,
    visibleDimPickKeys,
    dimPickAllSelected,
    dimPickSomeSelected,
    saveModal
  };
}
`
);

writeFileSync(
  path.join(panelDir, "access-user-detail-toolbar.tsx"),
  `"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

export function AccessUserDetailToolbar({ vm }: { vm: AccessUserDetailVm }) {
  const {
    inner,
    setInner,
    tableSearch,
    setTableSearch,
    modal,
    innerTabs,
    openModal,
    setModal
  } = vm;

  return (
${lines.slice(1377, 1467).join("\n")}
  );
}
`
);

writeFileSync(
  path.join(panelDir, "access-user-detail-operations-tab.tsx"),
  `"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import { Button } from "@/components/ui/button";
import { TableSortButton } from "@/components/ui/table-sort-button";
import { cn } from "@/lib/utils";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { permissionSourceLabel } from "@/lib/access-user-permission-matrix";
import { shortenPathLabel, type MatrixSortKey } from "./access-user-detail.types";
import type { PermissionSourceFilter } from "@/lib/access-user-permission-matrix";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

export function AccessUserDetailOperationsTab({ vm }: { vm: AccessUserDetailVm }) {
  const {
    inner,
    userAccountControls,
    userId,
    openModal,
    matrixRowGroups,
    matrixGroupsAllExpanded,
    toggleMatrixGroupsExpandCollapse,
    filterParentDraft,
    setFilterParentDraft,
    filterSourceDraft,
    setFilterSourceDraft,
    setFilterParent,
    setFilterSource,
    parentOptions,
    bulkFeedback,
    bulkSel,
    setBulkSel,
    bulkSelectableKeys,
    bulkHeaderCheckboxRef,
    bulkHeaderAllSelected,
    toggleBulkAll,
    matrixHeadScrollRef,
    matrixBodyScrollRef,
    onMatrixHeadScroll,
    onMatrixBodyScroll,
    matrixSort,
    toggleMatrixSort,
    grantHeaderSwitchRef,
    grantHeaderAllOn,
    bulkApplyGrantDelegation,
    tableMatrix,
    matrixGroupExpanded,
    setMatrixGroupExpanded,
    isRowBulkSelectable,
    toggleBulkGroup,
    patchMut,
    toggleRowGrantDelegation,
    selectedDetachableCount,
    bulkApplyFilteredEffective,
    bulkDetach
  } = vm;

  if (inner !== "operations") return null;

  return (
${lines.slice(1477, 1982).join("\n")}
  );
}
`
);

writeFileSync(
  path.join(panelDir, "access-user-detail-modals.tsx"),
  `"use client";

import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatTerritoryAssigneeSubtitle, shortenPathLabel, territoryLeafNameOnly, territoryZoneLabel } from "./access-user-detail.types";
import { IndeterminateCheckbox, TerritoryReferenceTreeRows } from "./access-user-detail-territory-ui";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

export function AccessUserDetailModals({ vm }: { vm: AccessUserDetailVm }) {
  const {
    modal,
    setModal,
    assignPickModal,
    modalTitle,
    modalSel,
    user,
    patchMut,
    catalogQ,
    territoriesQ,
    dimQ,
    modalSearch,
    setModalSearch,
    showSelOnly,
    setShowSelOnly,
    attachModalBaseItems,
    opAttachGroups,
    opAttachGroupKeys,
    allOpAttachGroupsExpanded,
    setOpAttachGroupExpanded,
    toggleOpAttachGroup,
    territoryCatalog,
    visibleTerritoryLeafKeys,
    useReferenceTerritoryTree,
    referenceTerritoryTree,
    territoryHierarchy,
    territoryExpanded,
    setTerritoryExpanded,
    territorySubExpanded,
    setTerritorySubExpanded,
    treeExpanded,
    setTreeExpanded,
    staffPickByRole,
    staffRoleExpanded,
    setStaffRoleExpanded,
    toggleExpandCollapseStaffRoles,
    allStaffGroupsInViewExpanded,
    staffPickBootstrapping,
    visibleStaffPickIds,
    filteredModalItems,
    dimPickModal,
    visibleDimPickKeys,
    dimPickAllSelected,
    dimPickSomeSelected,
    saveModal
  } = vm;

  return (
${lines.slice(1984, 2656).join("\n")}
  );
}
`
);

writeFileSync(
  path.join(root, "components/access/access-user-detail-panel.tsx"),
  `"use client";

export type { AccessUserAccountControls } from "./access-user-detail/access-user-detail.types";
export { AccessUserDetailPanel } from "./access-user-detail/access-user-detail-panel-view";
`
);

writeFileSync(
  path.join(panelDir, "access-user-detail-panel-view.tsx"),
  `"use client";

import { AccessUserDetailModals } from "./access-user-detail-modals";
import { AccessUserDetailOperationsTab } from "./access-user-detail-operations-tab";
import { AccessUserDetailToolbar } from "./access-user-detail-toolbar";
import { useAccessUserDetailPanel } from "./hooks/use-access-user-detail-panel";

export function AccessUserDetailPanel({
  tenantSlug,
  userId,
  onInvalidateUsers,
  userAccountControls
}: {
  tenantSlug: string;
  userId: number;
  onInvalidateUsers: () => void;
  userAccountControls?: AccessUserAccountControls | null;
}) {
  const vm = useAccessUserDetailPanel({ tenantSlug, userId, onInvalidateUsers, userAccountControls });

  if (vm.detailQ.isError) {
    return <p className="px-4 pt-16 text-sm text-destructive">Не удалось загрузить данные доступа</p>;
  }
  if (vm.detailQ.isLoading || !vm.user) {
    return <p className="px-4 pt-16 text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AccessUserDetailToolbar vm={vm} />
      <div className="min-h-0 flex-1 p-3 flex flex-col overflow-hidden overscroll-contain">
        <AccessUserDetailOperationsTab vm={vm} />
      </div>
      <AccessUserDetailModals vm={vm} />
    </div>
  );
}
`
);

for (const f of [
  "access-user-detail.types.ts",
  "access-user-detail-territory-ui.tsx",
  "hooks/use-access-user-detail-panel.ts",
  "access-user-detail-toolbar.tsx",
  "access-user-detail-operations-tab.tsx",
  "access-user-detail-modals.tsx",
  "access-user-detail-panel-view.tsx",
  "access-user-detail-panel.tsx"
]) {
  const p = f.startsWith("hooks/") ? path.join(panelDir, f) : path.join(panelDir, f);
  const real = f === "access-user-detail-panel.tsx" ? path.join(root, "components/access/access-user-detail-panel.tsx") : p;
  const n = readFileSync(real, "utf8").split(/\n/).length;
  console.log(`${f}\t${n}`);
}
