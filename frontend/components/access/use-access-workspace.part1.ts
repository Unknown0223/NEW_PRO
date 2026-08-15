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

export function useAccessWorkspacePart1({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  type AccessWorkspaceTab = "users" | "operations" | ScopeDimensionTab;
  const [tab, setTab] = useState<AccessWorkspaceTab>("users");
  const [dimensionUsersApiMissing, setDimensionUsersApiMissing] = useState(false);
  const [opSearch, setOpSearch] = useState("");
  const [opFilterRolesDraft, setOpFilterRolesDraft] = useState<Set<string>>(new Set());
  const [opFilterPositionsDraft, setOpFilterPositionsDraft] = useState<Set<string>>(new Set());
  const [opFilterGrantsDraft, setOpFilterGrantsDraft] = useState<Set<string>>(new Set());
  const [opFilterActivitiesDraft, setOpFilterActivitiesDraft] = useState<Set<string>>(new Set());
  const [opFilterRoles, setOpFilterRoles] = useState<Set<string>>(new Set());
  const [opFilterPositions, setOpFilterPositions] = useState<Set<string>>(new Set());
  const [opFilterGrants, setOpFilterGrants] = useState<Set<string>>(new Set());
  const [opFilterActivities, setOpFilterActivities] = useState<Set<string>>(new Set());
  const [opRoleFilterSearch, setOpRoleFilterSearch] = useState("");
  const [opPosFilterSearch, setOpPosFilterSearch] = useState("");
  const [cashSearch, setCashSearch] = useState("");
  const [cashFilterRolesDraft, setCashFilterRolesDraft] = useState<Set<string>>(new Set());
  const [cashFilterPositionsDraft, setCashFilterPositionsDraft] = useState<Set<string>>(new Set());
  const [cashFilterActivitiesDraft, setCashFilterActivitiesDraft] = useState<Set<string>>(new Set());
  const [cashFilterRoles, setCashFilterRoles] = useState<Set<string>>(new Set());
  const [cashFilterPositions, setCashFilterPositions] = useState<Set<string>>(new Set());
  const [cashFilterActivities, setCashFilterActivities] = useState<Set<string>>(new Set());
  const [cashRoleFilterSearch, setCashRoleFilterSearch] = useState("");
  const [cashPosFilterSearch, setCashPosFilterSearch] = useState("");
  const [opUsersModalOpen, setOpUsersModalOpen] = useState(false);
  const [usersModalKind, setUsersModalKind] = useState<AccessWorkspaceTab>("operations");
  const [opUsersModalSearch, setOpUsersModalSearch] = useState("");
  const [opUsersModalShowSelected, setOpUsersModalShowSelected] = useState(false);
  const [opUsersModalSelected, setOpUsersModalSelected] = useState<Set<number>>(new Set());
  const [opUsersModalExpandedRoles, setOpUsersModalExpandedRoles] = useState<Set<string>>(new Set());
  const [leftExpandedGroups, setLeftExpandedGroups] = useState<Set<string>>(new Set());
  const [leftExpandedSubgroups, setLeftExpandedSubgroups] = useState<Set<string>>(new Set());
  const [accessBulkSavePending, setAccessBulkSavePending] = useState(false);
  /** Чекбоксы строк в таблице «Операции» (правая панель) + массовые действия как у пользователя. */
  const [opDimBulkSel, setOpDimBulkSel] = useState<Set<number>>(() => new Set());
  const [opDimBulkFeedback, setOpDimBulkFeedback] = useState<null | { tone: "ok" | "err"; text: string }>(null);
  const [scopeDimBulkSel, setScopeDimBulkSel] = useState<Set<number>>(() => new Set());
  const [scopeDimBulkFeedback, setScopeDimBulkFeedback] = useState<null | { tone: "ok" | "err"; text: string }>(null);
  const [opDimUserSort, setOpDimUserSort] = useState<null | { key: DimUserSortKey; dir: TableSortDir }>(null);
  const [scopeDimUserSort, setScopeDimUserSort] = useState<null | { key: DimUserSortKey; dir: TableSortDir }>(null);
  const opDimBulkHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const opDimGrantHeaderSwitchRef = useRef<HTMLInputElement>(null);
  const scopeDimBulkHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const dimTableHeadScrollRef = useRef<HTMLDivElement>(null);
  const dimTableBodyScrollRef = useRef<HTMLDivElement>(null);

  const onDimTableHeadScroll = useCallback(() => {
    const head = dimTableHeadScrollRef.current;
    const body = dimTableBodyScrollRef.current;
    if (!head || !body) return;
    if (Math.abs(body.scrollLeft - head.scrollLeft) < 1) return;
    body.scrollLeft = head.scrollLeft;
  }, []);

  const onDimTableBodyScroll = useCallback(() => {
    const head = dimTableHeadScrollRef.current;
    const body = dimTableBodyScrollRef.current;
    if (!head || !body) return;
    if (Math.abs(head.scrollLeft - body.scrollLeft) < 1) return;
    head.scrollLeft = body.scrollLeft;
  }, []);

  /**
   * Bulk/патч keyin: jadvalni darhol yangilash uchun faqat aktiv `dimension-users` ni `refetch`,
   * qolgani (dimensions, users ro‘yxati) — fon rejimida invalidate (umumiy vaqt ~1s ga yaqinlashadi).
   */
  const invalidateAccessWorkspaceCaches = useCallback(async () => {
    const dimBase = ["access-dimension-users", tenantSlug, tab] as const;
    if (selectedKey) {
      await qc.refetchQueries({ queryKey: [...dimBase, selectedKey], type: "active" });
    } else {
      await qc.refetchQueries({ queryKey: [...dimBase], type: "active" });
    }
    void qc.invalidateQueries({ queryKey: ["access-dimensions", tenantSlug, tab] });
    void qc.invalidateQueries({ queryKey: ["access-users-for-operation-modal", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["access-users", tenantSlug] });
  }, [qc, tenantSlug, tab, selectedKey]);

  const usersQ = useQuery({
    queryKey: ["access-users", tenantSlug, search, status],
    staleTime: 45_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    /** «Операции/кассы…» — chapda `dimensions`; ikki og‘ir GET kerak emas (terminaldagi 120+ ms). */
    enabled: Boolean(tenantSlug) && tab === "users",
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search.trim()) p.set("search", search.trim());
      /** `is_active` yo‘q — backend barcha foydalanuvchilarni bitta so‘rovda qaytaradi; filtr — clientda. */
      const { data } = await api.get<{ data: AccessUserRow[] }>(
        `/api/${tenantSlug}/access/users?${p.toString()}`
      );
      return data.data ?? [];
    }
  });

  /** Foydalanuvchi kartasidagi ketma-ket PATCH — ikki og‘ir GETni birlashtirish. */
  const accessUsersRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAccessUsersListRefresh = useCallback(() => {
    if (accessUsersRefreshTimer.current) clearTimeout(accessUsersRefreshTimer.current);
    accessUsersRefreshTimer.current = setTimeout(() => {
      accessUsersRefreshTimer.current = null;
      void qc.refetchQueries({ queryKey: ["access-users", tenantSlug], type: "active" });
    }, 900);
  }, [qc, tenantSlug]);

  useEffect(
    () => () => {
      if (accessUsersRefreshTimer.current) clearTimeout(accessUsersRefreshTimer.current);
    },
    []
  );

  const dimensionsQ = useQuery({
    queryKey: ["access-dimensions", tenantSlug, tab],
    staleTime: 45_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantSlug) && tab !== "users",
    queryFn: async () => {
      const params = new URLSearchParams({ type: tab });
      const { data } = await api.get<{
        data: { key: string; label: string; attached_users_count: number; is_active: boolean }[];
      }>(`/api/${tenantSlug}/access/dimensions?${params.toString()}`);
      return data.data;
    }
  });

  const scopeTabsNeedFullUserScope =
    isScopeDimensionTab(tab) && Boolean(selectedKey);

  const allUsersForOperationModalQ = useQuery({
    queryKey: ["access-users-for-operation-modal", tenantSlug],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    enabled:
      Boolean(tenantSlug) &&
      (scopeTabsNeedFullUserScope ||
        (tab === "operations" && Boolean(selectedKey)) ||
        (opUsersModalOpen &&
          (tab === "operations" || isScopeDimensionTab(tab)))),
    queryFn: async () => {
      const { data } = await api.get<{ data: AccessUserRow[] }>(
        `/api/${tenantSlug}/access/users?include_counts=false&include_access_manage=true&is_active=true`
      );
      return data.data;
    }
  });

  const toggleMut = useMutation({
    mutationFn: async (row: AccessUserRow) => {
      await api.patch(`/api/${tenantSlug}/access/users/${row.id}`, { is_active: row.status !== "active" });
    },
    onSuccess: async (_data, variables: AccessUserRow) => {
      /** Chap ro‘yxatda kartochka qolib turishi va «Активные/Неактивные» bilan moslashishi uchun. */
      if (variables.status === "active") setStatus("inactive");
      else setStatus("active");
      await qc.invalidateQueries({ queryKey: ["access-users", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["access-user-detail", tenantSlug, variables.id] });
    }
  });

  const resetMut = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/access/users/${id}/reset`, {});
    },
    onSuccess: async (_data, id) => {
      await qc.invalidateQueries({ queryKey: ["access-users", tenantSlug] });
      invalidateMePermissionsQueries(qc, tenantSlug, { userId: id });
    }
  });

  type OpAccessMutCtx = {
    previous: DimensionUserRow[] | null;
    /** `["access-dimension-users", tenantSlug, tab, dimensionKey]` */
    qk: readonly [string, string, string, string | undefined];
  };

  return { tenantSlug, qc, search, setSearch, status, setStatus, selectedKey, setSelectedKey, tab, setTab, dimensionUsersApiMissing, setDimensionUsersApiMissing, opSearch, setOpSearch, opFilterRolesDraft, setOpFilterRolesDraft, opFilterPositionsDraft, setOpFilterPositionsDraft, opFilterGrantsDraft, setOpFilterGrantsDraft, opFilterActivitiesDraft, setOpFilterActivitiesDraft, opFilterRoles, setOpFilterRoles, opFilterPositions, setOpFilterPositions, opFilterGrants, setOpFilterGrants, opFilterActivities, setOpFilterActivities, opRoleFilterSearch, setOpRoleFilterSearch, opPosFilterSearch, setOpPosFilterSearch, cashSearch, setCashSearch, cashFilterRolesDraft, setCashFilterRolesDraft, cashFilterPositionsDraft, setCashFilterPositionsDraft, cashFilterActivitiesDraft, setCashFilterActivitiesDraft, cashFilterRoles, setCashFilterRoles, cashFilterPositions, setCashFilterPositions, cashFilterActivities, setCashFilterActivities, cashRoleFilterSearch, setCashRoleFilterSearch, cashPosFilterSearch, setCashPosFilterSearch, opUsersModalOpen, setOpUsersModalOpen, usersModalKind, setUsersModalKind, opUsersModalSearch, setOpUsersModalSearch, opUsersModalShowSelected, setOpUsersModalShowSelected, opUsersModalSelected, setOpUsersModalSelected, opUsersModalExpandedRoles, setOpUsersModalExpandedRoles, leftExpandedGroups, setLeftExpandedGroups, leftExpandedSubgroups, setLeftExpandedSubgroups, accessBulkSavePending, setAccessBulkSavePending, opDimBulkSel, setOpDimBulkSel, opDimBulkFeedback, setOpDimBulkFeedback, scopeDimBulkSel, setScopeDimBulkSel, scopeDimBulkFeedback, setScopeDimBulkFeedback, opDimUserSort, setOpDimUserSort, scopeDimUserSort, setScopeDimUserSort, opDimBulkHeaderCheckboxRef, opDimGrantHeaderSwitchRef, scopeDimBulkHeaderCheckboxRef, dimTableHeadScrollRef, dimTableBodyScrollRef, onDimTableHeadScroll, onDimTableBodyScroll, invalidateAccessWorkspaceCaches, usersQ, scheduleAccessUsersListRefresh, dimensionsQ, allUsersForOperationModalQ, toggleMut, resetMut } as const;
}
