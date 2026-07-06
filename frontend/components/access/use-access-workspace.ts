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
  type ScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";

import { useAccessWorkspacePart1 } from "./use-access-workspace.part1";
import { useAccessWorkspacePart2 } from "./use-access-workspace.part2";
import { useAccessWorkspacePart3 } from "./use-access-workspace.part3";
import { useAccessWorkspacePart4 } from "./use-access-workspace.part4";
import { useAccessWorkspacePart5 } from "./use-access-workspace.part5";

export type UseAccessWorkspaceReturn = ReturnType<typeof useAccessWorkspacePart5>;

export function useAccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  return useAccessWorkspacePart5(useAccessWorkspacePart4(useAccessWorkspacePart3(useAccessWorkspacePart2(useAccessWorkspacePart1({ tenantSlug })))));
}
