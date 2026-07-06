#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "access");
const bak = fs.readFileSync(path.join(dir, "access-workspace.tsx.bak"), "utf8").split(/\r?\n/);
const L = (a, b) => bak.slice(a - 1, b).join("\n");
const w = (name, body) => {
  const t = body.endsWith("\n") ? body : body + "\n";
  fs.writeFileSync(path.join(dir, name), t);
  console.log(name, t.split(/\r?\n/).length);
};

// --- shared.ts ---
w(
  "access-workspace.shared.ts",
  `import type { SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import type { TableSortDir } from "@/components/ui/table-sort-button";

${L(22, 49)}
${L(86, 115)}
${L(117, 204)}
${L(219, 360)}
export type AccessBulkPatchItem = Record<string, unknown> & { user_id: number };
${L(369, 418)}`.replace(/^function /gm, "export function ").replace(/^type /gm, "export type ").replace(/^const (OP_|ACCESS_)/gm, "export const $1")
);

// --- shared-ui ---
w(
  "access-workspace.shared-ui.tsx",
  `"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

export ${L(50, 84).replace(/^function /, "function ")}

export ${L(206, 217).replace(/^function /, "function ")}`
);

// --- hook: 3 segments in one function via includes ---
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

w("use-access-workspace.segment-a.ts", `${hookHead}\nexport const ACCESS_WORKSPACE_SEGMENT_A = ${JSON.stringify(L(421, 850))};\n`);
w("use-access-workspace.segment-b.ts", `${hookHead}\nexport const ACCESS_WORKSPACE_SEGMENT_B = ${JSON.stringify(L(851, 1200))};\n`);
w("use-access-workspace.segment-c.ts", `${hookHead}\nexport const ACCESS_WORKSPACE_SEGMENT_C = ${JSON.stringify(L(1201, 1526))};\n`);

// Full hook file for splitHookLayers
w(
  "use-access-workspace.ts",
  `${hookHead}
export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
${L(421, 1526)}
  return {
    tenantSlug,
    search, setSearch,
    status, setStatus,
    selectedKey, setSelectedKey,
    tab, setTab,
    dimensionUsersApiMissing,
    opSearch, setOpSearch,
    opFilterRolesDraft, setOpFilterRolesDraft,
    opFilterPositionsDraft, setOpFilterPositionsDraft,
    opFilterGrantsDraft, setOpFilterGrantsDraft,
    opFilterActivitiesDraft, setOpFilterActivitiesDraft,
    opFilterRoles, setOpFilterRoles,
    opFilterPositions, setOpFilterPositions,
    opFilterGrants, setOpFilterGrants,
    opFilterActivities, setOpFilterActivities,
    opRoleFilterSearch, setOpRoleFilterSearch,
    opPosFilterSearch, setOpPosFilterSearch,
    cashSearch, setCashSearch,
    cashFilterRolesDraft, setCashFilterRolesDraft,
    cashFilterPositionsDraft, setCashFilterPositionsDraft,
    cashFilterActivitiesDraft, setCashFilterActivitiesDraft,
    cashFilterRoles, setCashFilterRoles,
    cashFilterPositions, setCashFilterPositions,
    cashFilterActivities, setCashFilterActivities,
    cashRoleFilterSearch, setCashRoleFilterSearch,
    cashPosFilterSearch, setCashPosFilterSearch,
    opUsersModalOpen, setOpUsersModalOpen,
    usersModalKind, setUsersModalKind,
    opUsersModalSearch, setOpUsersModalSearch,
    opUsersModalShowSelected, setOpUsersModalShowSelected,
    opUsersModalSelected, setOpUsersModalSelected,
    opUsersModalExpandedRoles, setOpUsersModalExpandedRoles,
    leftExpandedGroups, setLeftExpandedGroups,
    leftExpandedSubgroups, setLeftExpandedSubgroups,
    accessBulkSavePending,
    opDimBulkSel, setOpDimBulkSel,
    opDimBulkFeedback,
    scopeDimBulkSel, setScopeDimBulkSel,
    scopeDimBulkFeedback,
    opDimUserSort,
    scopeDimUserSort,
    opDimBulkHeaderCheckboxRef,
    opDimGrantHeaderSwitchRef,
    scopeDimBulkHeaderCheckboxRef,
    dimTableHeadScrollRef,
    dimTableBodyScrollRef,
    onDimTableHeadScroll,
    onDimTableBodyScroll,
    scheduleAccessUsersListRefresh,
    usersQ,
    dimensionsQ,
    allUsersForOperationModalQ,
    toggleMut,
    resetMut,
    operationAccessMut,
    opDimAccessBusyUserId,
    getOpEffective,
    getOpPatchBodyForToggle,
    rows,
    selected,
    startListNavTransition,
    selectSideRowKey,
    filteredSideRows,
    isNestedOperationRow,
    groupedFilteredSideRows,
    operationNestedGroups,
    selectedDimension,
    dimensionUsersQ,
    prefetchDimensionUsersForKey,
    operationRoleFilterItems,
    operationPositionFilterItems,
    operationRoleOptions,
    operationPositionOptions,
    cashRoleFilterItems,
    cashPositionFilterItems,
    cashRoleOptions,
    cashPositionOptions,
    filteredOperationUsers,
    filteredCashUsers,
    displayOperationUsers,
    displayCashUsers,
    toggleOpDimUserSort,
    toggleScopeDimUserSort,
    modalBulkItems,
    modalBulkSummaryText,
    modalGrantValidationError,
    opDimBulkAllVisibleSelected,
    opDimGrantHeaderAllOn,
    toggleOpDimSelectAllVisible,
    bulkApplyOpDimEffective,
    bulkDetachOpDimSelected,
    scopeDimBulkAllVisibleSelected,
    toggleScopeDimSelectAllVisible,
    bulkDetachScopeDimLinks,
    opModalRoleGroups,
    activeTabLabel,
    allVisibleModalUserIds,
    modalRoleKeys,
    allModalGroupsExpanded,
    allVisibleModalSelected,
    allVisibleModalSomeSelected,
    toggleModalRoleExpanded,
    toggleModalSelectAllVisible,
    toggleModalSelectRole,
    saveOperationUsersModal,
    detachScopeUser,
    opDimVirtualItems,
    opDimPadTop,
    opDimPadBot,
    scopeDimVirtualItems,
    scopeDimPadTop,
    scopeDimPadBot,
    opModalUsersById,
    opUsersById,
    opModalUsers,
  } as const;
}
`
);

// wsify - exclude short names that break JSX/string literals
const SKIP = new Set(["tab", "status", "search", "selected", "key", "role"]);
const hookVars = `tenantSlug,setSearch,setStatus,setSelectedKey,setTab,setDimensionUsersApiMissing,setOpSearch,setOpFilterRolesDraft,setOpFilterPositionsDraft,setOpFilterGrantsDraft,setOpFilterActivitiesDraft,setOpFilterRoles,setOpFilterPositions,setOpFilterGrants,setOpFilterActivities,setOpRoleFilterSearch,setOpPosFilterSearch,setCashSearch,setCashFilterRolesDraft,setCashFilterPositionsDraft,setCashFilterActivitiesDraft,setCashFilterRoles,setCashFilterPositions,setCashFilterActivities,setCashRoleFilterSearch,setCashPosFilterSearch,setOpUsersModalOpen,setUsersModalKind,setOpUsersModalSearch,setOpUsersModalShowSelected,setOpUsersModalSelected,setOpUsersModalExpandedRoles,setLeftExpandedGroups,setLeftExpandedSubgroups,setAccessBulkSavePending,setOpDimBulkSel,setOpDimBulkFeedback,setScopeDimBulkSel,setScopeDimBulkFeedback,setOpDimUserSort,setScopeDimUserSort,opDimBulkHeaderCheckboxRef,opDimGrantHeaderSwitchRef,scopeDimBulkHeaderCheckboxRef,dimTableHeadScrollRef,dimTableBodyScrollRef,onDimTableHeadScroll,onDimTableBodyScroll,scheduleAccessUsersListRefresh,usersQ,dimensionsQ,allUsersForOperationModalQ,toggleMut,resetMut,operationAccessMut,opDimAccessBusyUserId,getOpEffective,getOpPatchBodyForToggle,rows,selected,startListNavTransition,selectSideRowKey,filteredSideRows,isNestedOperationRow,groupedFilteredSideRows,operationNestedGroups,selectedDimension,dimensionUsersQ,prefetchDimensionUsersForKey,operationRoleFilterItems,operationPositionFilterItems,operationRoleOptions,operationPositionOptions,cashRoleFilterItems,cashPositionFilterItems,cashRoleOptions,cashPositionOptions,filteredOperationUsers,filteredCashUsers,displayOperationUsers,displayCashUsers,toggleOpDimUserSort,toggleScopeDimUserSort,modalBulkItems,modalBulkSummaryText,modalGrantValidationError,opDimBulkAllVisibleSelected,opDimGrantHeaderAllOn,toggleOpDimSelectAllVisible,bulkApplyOpDimEffective,bulkDetachOpDimSelected,scopeDimBulkAllVisibleSelected,toggleScopeDimSelectAllVisible,bulkDetachScopeDimLinks,opModalRoleGroups,activeTabLabel,allVisibleModalUserIds,modalRoleKeys,allModalGroupsExpanded,allVisibleModalSelected,allVisibleModalSomeSelected,toggleModalRoleExpanded,toggleModalSelectAllVisible,toggleModalSelectRole,saveOperationUsersModal,detachScopeUser,opDimVirtualItems,opDimPadTop,opDimPadBot,scopeDimVirtualItems,scopeDimPadTop,scopeDimPadBot,opModalUsersById,opUsersById,opModalUsers,opDimBulkSel,scopeDimBulkSel,accessBulkSavePending,opDimBulkFeedback,scopeDimBulkFeedback,opDimUserSort,scopeDimUserSort,opUsersModalOpen,usersModalKind,opUsersModalSearch,opUsersModalShowSelected,opUsersModalSelected,opUsersModalExpandedRoles,leftExpandedGroups,leftExpandedSubgroups,opFilterRolesDraft,opFilterPositionsDraft,opFilterGrantsDraft,opFilterActivitiesDraft,opFilterRoles,opFilterPositions,opFilterGrants,opFilterActivities,opRoleFilterSearch,opPosFilterSearch,cashFilterRolesDraft,cashFilterPositionsDraft,cashFilterActivitiesDraft,cashFilterRoles,cashFilterPositions,cashFilterActivities,cashRoleFilterSearch,cashPosFilterSearch,opSearch,cashSearch,selectedKey,dimensionUsersApiMissing,opDimAccessBusyUserId`.split(",");

function wsify(block) {
  const sorted = hookVars.filter((k) => !SKIP.has(k)).sort((a, b) => b.length - a.length);
  return block
    .split("\n")
    .map((line) => {
      let out = line;
      for (const k of sorted) {
        out = out.replace(new RegExp(`\\b${k}\\b(?!\\s*=)`, "g"), (m, off, s) => {
          if (s.slice(Math.max(0, off - 4), off).endsWith("ws.")) return m;
          return `ws.${k}`;
        });
      }
      for (const k of ["tab", "status", "search", "selected"]) {
        out = out.replace(new RegExp(`([^w])\\b${k}\\b(?!\\s*=)(?![."'])`, "g"), `$1ws.${k}`);
        out = out.replace(new RegExp(`^\\s*\\b${k}\\b(?!\\s*=)`, "g"), `ws.${k}`);
      }
      return out;
    })
    .join("\n");
}

const panelHead = `"use client";

import { Search } from "lucide-react";
import { TableSortButton } from "@/components/ui/table-sort-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import {
  ACCESS_FILTER_MULTI_SEARCH_MIN,
  ACCESS_MANAGE_KEY,
  OP_ACTIVITY_FILTER_ITEMS,
  OP_GRANT_FILTER_ITEMS,
  buildScopeDimensionPatchBody,
  formatAccessFilterTriggerSummary,
  type ScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";
import { AccessDimUsersColGroup } from "./access-workspace.shared-ui";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";
`;

w("access-workspace-left-panel.tsx", `${panelHead}\nexport function AccessWorkspaceLeftPanel({ ws }: { ws: UseAccessWorkspaceReturn }) {\n  return (\n${wsify(L(1571, 1882))}\n  );\n}\n`);
w("access-workspace-operations-panel.tsx", `${panelHead}\nexport function AccessWorkspaceOperationsPanel({ ws }: { ws: UseAccessWorkspaceReturn }) {\n  return (\n${wsify(L(1913, 2302))}\n  );\n}\n`);
w("access-workspace-scope-panel.tsx", `${panelHead}\nexport function AccessWorkspaceScopePanel({ ws }: { ws: UseAccessWorkspaceReturn }) {\n  return (\n${wsify(L(2304, 2601))}\n  );\n}\n`);

w(
  "access-workspace-user-picker-modal.tsx",
  `"use client";

import { ChevronDown, ChevronRight, ChevronsDownUp, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ACCESS_MANAGE_KEY,
  accessModalRoleGroupLabel,
  accessModalUserBranchLine,
  accessModalUserPrimaryLine,
  accessWorkspaceUserPickerModalTitle,
  type AccessUserRow,
} from "./access-workspace.shared";
import { IndeterminateCheckbox } from "./access-workspace.shared-ui";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

export function AccessWorkspaceUserPickerModal({ ws }: { ws: UseAccessWorkspaceReturn }) {
  return (
${wsify(L(2616, 2867))}
  );
}
`
);

w(
  "access-workspace.tsx",
  `"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { AccessWorkspaceLeftPanel } from "./access-workspace-left-panel";
import { AccessWorkspaceOperationsPanel } from "./access-workspace-operations-panel";
import { AccessWorkspaceScopePanel } from "./access-workspace-scope-panel";
import { AccessWorkspaceUserPickerModal } from "./access-workspace-user-picker-modal";
import { AccessUserDetailPanel } from "@/components/access/access-user-detail-panel";
import { useAccessWorkspace } from "./use-access-workspace";

export function AccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const ws = useAccessWorkspace({ tenantSlug });

  return (
    <div className="access-surface flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 p-3">
      <div className="access-hub-toolbar w-full shrink-0">
        <div className="flex flex-wrap gap-1">
          {[
            { key: "users", label: "Пользователи" },
            { key: "operations", label: "Операции" },
            { key: "cash_desks", label: "Кассы" },
            { key: "warehouses", label: "Склады" },
            { key: "branches", label: "Филиалы" },
            { key: "payment_methods", label: "Способы оплаты" }
          ].map((x) => (
            <button
              key={x.key}
              data-active={ws.tab === x.key}
              className={\`access-tab-chip \${ws.tab === x.key ? "" : "text-muted-foreground hover:bg-muted/50"}\`}
              onClick={() => {
                ws.setTab(x.key as typeof ws.tab);
                ws.startListNavTransition(() => ws.setSelectedKey(null));
              }}
              type="button"
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/access/role-defaults" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs no-underline")}>
            Состав ролей по умолчанию
          </Link>
          <Link href="/access/history" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs no-underline")}>
            История изменения доступов
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch">
        <AccessWorkspaceLeftPanel ws={ws} />
        <div className="access-right-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {ws.tab === "users" && ws.selected ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <AccessUserDetailPanel
                tenantSlug={ws.tenantSlug}
                userId={ws.selected.id}
                onInvalidateUsers={ws.scheduleAccessUsersListRefresh}
                userAccountControls={{
                  isActive: ws.selected.status === "active",
                  onToggle: () => void ws.toggleMut.mutateAsync(ws.selected!),
                  onReset: (id) => { if (id !== ws.selected!.id) return; void ws.resetMut.mutateAsync(id); },
                  togglePending: ws.toggleMut.isPending && ws.toggleMut.variables?.id === ws.selected!.id,
                  resetPending: ws.resetMut.isPending && ws.resetMut.variables === ws.selected!.id
                }}
              />
            </div>
          ) : ws.tab !== "users" && ws.selectedDimension ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden overscroll-contain p-3 sm:p-4">
              {ws.dimensionUsersApiMissing ? (
                <div className="shrink-0 rounded-md border border-border/60 bg-card p-3 shadow-sm sm:p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    API dimensions/users пока недоступен в текущем backend runtime. Перезапустите backend dev-процесс.
                  </p>
                </div>
              ) : null}
              {ws.tab === "operations" ? <AccessWorkspaceOperationsPanel ws={ws} /> : null}
              {(ws.tab === "cash_desks" || ws.tab === "warehouses" || ws.tab === "branches" || ws.tab === "payment_methods") ? (
                <AccessWorkspaceScopePanel ws={ws} />
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {ws.tab === "users" && ws.selectedKey && !ws.selected
                  ? "Пользователь не найден в списке (обновите поиск или фильтр)."
                  : \`Выберите запись в «\${ws.activeTabLabel}» слева.\`}
              </p>
            </div>
          )}
        </div>
      </div>
      <AccessWorkspaceUserPickerModal ws={ws} />
    </div>
  );
}
`
);
