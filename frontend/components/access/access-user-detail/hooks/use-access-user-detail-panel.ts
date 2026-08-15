"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TableSortDir } from "@/components/ui/table-sort-button";
import { api } from "@/lib/api";
import { invalidateMePermissionsQueries } from "@/lib/me-permissions";
import {
  normalizeAccessGrantPermissions,
  buildGrantDelegationPatchBody,
  chunkGrantDelegationPatchBodies,
  parseGrantDelegationPatch,
  grantDelegationKeysNeedingChange,
  applyGrantDelegationDetailCache
} from "@/components/access/access-workspace.shared";
import { displayAccessDescriptionShort, splitPermissionPath } from "@/lib/access-display";
import {
  buildOpAttachTree,
  collectOpAttachExpandableIds,
  collectOpAttachLeafKeys,
  type OpAttachTreeNode
} from "@/lib/access-op-attach-tree";
import {
  buildRevokeEffectiveAccessPatch,
  isGrantedMatrixRow,
  isMatrixRowBulkSelectable,
  matchesPermissionSourceFilter,
  permissionSourceLabel,
  type PermissionSourceFilter
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
  type AccessTerritoryTreeNode,
  flattenTerritoryTreeIdStrings,
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
  const qc = useQueryClient();
  const [inner, setInner] = useState<InnerTab>("operations");
  const [filterParent, setFilterParent] = useState("");
  /** Rol (boshlang‘ich) vs qo‘shimcha (shaxsiy allow). */
  const [filterSource, setFilterSource] = useState<PermissionSourceFilter>("all");
  const [filterParentDraft, setFilterParentDraft] = useState("");
  const [filterSourceDraft, setFilterSourceDraft] = useState<PermissionSourceFilter>("all");
  const [tableSearch, setTableSearch] = useState("");
  const [matrixSort, setMatrixSort] = useState<null | { key: MatrixSortKey; dir: TableSortDir }>(null);
  const [bulkSel, setBulkSel] = useState<Set<string>>(() => new Set());
  const [bulkFeedback, setBulkFeedback] = useState<null | { tone: "ok" | "err"; text: string }>(null);
  const bulkHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const grantHeaderSwitchRef = useRef<HTMLInputElement>(null);
  const matrixHeadScrollRef = useRef<HTMLDivElement>(null);
  const matrixBodyScrollRef = useRef<HTMLDivElement>(null);

  const onMatrixHeadScroll = useCallback(() => {
    const head = matrixHeadScrollRef.current;
    const body = matrixBodyScrollRef.current;
    if (!head || !body) return;
    if (Math.abs(body.scrollLeft - head.scrollLeft) < 1) return;
    body.scrollLeft = head.scrollLeft;
  }, []);

  const onMatrixBodyScroll = useCallback(() => {
    const head = matrixHeadScrollRef.current;
    const body = matrixBodyScrollRef.current;
    if (!head || !body) return;
    if (Math.abs(head.scrollLeft - body.scrollLeft) < 1) return;
    head.scrollLeft = body.scrollLeft;
  }, []);

  const [modal, setModal] = useState<null | "operations" | "cash" | "warehouse" | "branch" | "payment" | "direction" | "territory" | "staff">(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalSel, setModalSel] = useState<Set<string>>(() => new Set());
  const [showSelOnly, setShowSelOnly] = useState(false);
  const [territoryExpanded, setTerritoryExpanded] = useState<Set<string>>(() => new Set());
  const [territorySubExpanded, setTerritorySubExpanded] = useState<Set<string>>(() => new Set());
  const [treeExpanded, setTreeExpanded] = useState<Set<number>>(() => new Set());
  /** Роли с развёрнутым списком в модалке «Сотрудники» (массив — стабильные обновления для React). */
  const [staffRoleExpanded, setStaffRoleExpanded] = useState<string[]>(() => []);
  /** Jadval «Операции»: guruh (parent_path) ochiq/yopiqligi. */
  const [matrixGroupExpanded, setMatrixGroupExpanded] = useState<Set<string>>(() => new Set());
  /** Модалка «Прикрепить операции»: guruhlar bo‘yicha. */
  const [opAttachGroupExpanded, setOpAttachGroupExpanded] = useState<Set<string>>(() => new Set());
  /** «Открепить» qilgandan keyin jadvaldan yashiriladi; modaldan qayta qo‘shilguncha saqlanadi. */
  const [suppressedMatrixKeys, setSuppressedMatrixKeys] = useState<Set<string>>(() => new Set());
  /** Модалка открыта до прихода detail — подтянуть supervisees, когда detail загрузится. */
  const staffOpenedBeforeDetailRef = useRef(false);
  /** Каждое открытие модалки «Сотрудники» — новый номер; авто-разворот ролей только один раз на сессию (не затирать свёрнутые при refetch). */
  const staffModalSessionRef = useRef(0);
  const staffExpandAppliedForSessionRef = useRef(0);

  useEffect(() => {
    if (inner !== "operations") setTableSearch("");
  }, [inner]);

  useEffect(() => {
    setMatrixSort(null);
    setFilterParent("");
    setFilterSource("all");
    setFilterParentDraft("");
    setFilterSourceDraft("all");
    setSuppressedMatrixKeys(new Set());
  }, [userId]);

  const detailQ = useQuery({
    queryKey: ["access-user-detail", tenantSlug, userId],
    queryFn: async () => {
      const { data } = await api.get<{ data: DetailResponse }>(`/api/${tenantSlug}/access/users/${userId}/detail`);
      return data.data;
    }
  });

  /** После refetch серверные effective/role строки не должны оставаться скрытыми optimistic suppress. */
  useEffect(() => {
    setSuppressedMatrixKeys(new Set());
  }, [detailQ.dataUpdatedAt]);
  const catalogQ = useQuery({
    queryKey: ["access-permission-catalog", tenantSlug],
    queryFn: async () => {
      const { data } = await api.get<{ data: { flat: { key: string; parent_path: string; description: string | null }[] } }>(
        `/api/${tenantSlug}/access/permissions/catalog`
      );
      return data.data;
    },
    enabled: Boolean(tenantSlug) && (modal === "operations" || inner === "operations"),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false
  });

  const territoriesQ = useQuery({
    queryKey: ["access-territories", tenantSlug],
    queryFn: async (): Promise<AccessTerritoriesCatalog> => {
      const { data } = await api.get<{ data?: TerritoryApiRow[]; tree?: AccessTerritoryTreeNode[] }>(
        `/api/${tenantSlug}/access/territories`
      );
      const flat = Array.isArray(data.data) ? data.data : [];
      const tree = Array.isArray(data.tree) ? data.tree : [];
      return { flat, tree };
    },
    enabled: Boolean(tenantSlug) && modal === "territory",
    /**
     * Settings → Территория saqlangach ham shu ro‘yxat yangilansin.
     * Uzoq staleTime bo‘sh (yoki eski) keshni «Нет доступных территорий» qilib qoldirardi.
     */
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });

  /** Список сотрудников по тенанту: подгружаем при открытой карточке доступа, чтобы модалка открывалась без ожидания. */
  const supervisorPickQ = useQuery({
    queryKey: ["access-users-supervisor-pick", tenantSlug],
    queryFn: async () => {
      const { data } = await api.get<{ data: SupervisorPickRow[] }>(
        `/api/${tenantSlug}/access/users?mode=supervisor_pick`
      );
      return data.data;
    },
    enabled: Boolean(tenantSlug) && userId > 0 && (modal === "staff" || detailQ.isSuccess),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  });

  const territoryCatalog = territoriesQ.data;
  const allTerritoryRows = useMemo(() => territoryCatalog?.flat ?? [], [territoryCatalog?.flat]);
  const referenceTerritoryTree = territoryCatalog?.tree ?? [];
  const useReferenceTerritoryTree = referenceTerritoryTree.length > 0;

  const territoryHierarchy = useMemo(
    () => (useReferenceTerritoryTree ? [] : buildTerritoryHierarchy(allTerritoryRows)),
    [useReferenceTerritoryTree, allTerritoryRows]
  );

  const visibleTerritoryLeafKeys = useMemo(() => {
    if (!territoryCatalog) return [];
    if (territoryCatalog.tree.length > 0) return flattenTerritoryTreeIdStrings(territoryCatalog.tree);
    return territoryCatalog.flat.map((r) => String(r.id));
  }, [territoryCatalog]);

  /** По умолчанию зона и область свёрнуты; шеврон раскрывает уровень. */
  useEffect(() => {
    if (modal !== "territory") {
      setTerritoryExpanded(new Set());
      setTerritorySubExpanded(new Set());
      setTreeExpanded(new Set());
      return;
    }
    setTerritoryExpanded(new Set());
    setTerritorySubExpanded(new Set());
    setTreeExpanded(new Set());
  }, [modal]);

  const dimQ = useQuery({
    queryKey: ["access-dimensions-modal", tenantSlug, modal],
    enabled: Boolean(tenantSlug) && (modal === "cash" || modal === "warehouse" || modal === "branch" || modal === "payment" || modal === "direction"),
    queryFn: async () => {
      const type =
        modal === "cash"
          ? "cash_desks"
          : modal === "warehouse"
            ? "warehouses"
            : modal === "branch"
              ? "branches"
              : modal === "direction"
                ? "trade_directions"
                : "payment_methods";
      const { data } = await api.get<{ data: DimRow[] }>(`/api/${tenantSlug}/access/dimensions?type=${type}`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.patch(`/api/${tenantSlug}/access/users/${userId}`, body);
    },
    onSuccess: (_data, body) => {
      const deleg = parseGrantDelegationPatch(body);
      if (deleg) {
        qc.setQueryData<DetailResponse>(["access-user-detail", tenantSlug, userId], (old) =>
          applyGrantDelegationDetailCache(old, deleg.allowKeys, deleg.revokeKeys)
        );
        return;
      }
      const rm = body.remove_permission_keys as string[] | undefined;
      if (Array.isArray(rm) && rm.length > 0) {
        setSuppressedMatrixKeys((prev) => {
          const next = new Set(prev);
          for (const k of rm) next.add(String(k));
          return next;
        });
      }
      if (body.merge_permissions === true) {
        const add = body.permissions as string[] | undefined;
        if (Array.isArray(add) && add.length > 0) {
          setSuppressedMatrixKeys((prev) => {
            const next = new Set(prev);
            for (const k of add) next.delete(String(k));
            return next;
          });
        }
      }
      void qc.invalidateQueries({ queryKey: ["access-user-detail", tenantSlug, userId] });
      // Agar admin o‘zi yoki boshqa tabdagi operator — menyu yangilansin.
      invalidateMePermissionsQueries(qc, tenantSlug, { userId });
      if (body.supervisee_user_ids != null) {
        void qc.invalidateQueries({ queryKey: ["access-users-supervisor-pick", tenantSlug] });
        // Operator/SVR agent doirasi o‘zgardi — buyurtmalar va agent filtrlari yangilansin.
        void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["agents", tenantSlug] });
      }
      if (patchTouchesUserDirectory(body)) onInvalidateUsers();
    }
  });

  const grantDelegationSet = useMemo(() => {
    const keys = detailQ.data?.grant_delegation_operation_keys;
    return keys ? new Set(keys) : null;
  }, [detailQ.data?.grant_delegation_operation_keys]);

  const matrix = useMemo(
    () =>
      (detailQ.data?.matrix ?? []).map((row) => ({
        ...row,
        can_grant_others: grantDelegationSet ? grantDelegationSet.has(row.key) : Boolean(row.can_grant_others)
      })),
    [detailQ.data?.matrix, grantDelegationSet]
  );
  const matrixByKey = useMemo(() => new Map(matrix.map((r) => [r.key, r] as const)), [matrix]);
  const user = detailQ.data?.user;
  const scope = detailQ.data?.scope;

  /** Faqat foydalanuvchi ishlata oladigan operatsiyalar (rol + qo‘shimcha allow). */
  const grantedMatrix = useMemo(() => matrix.filter(isGrantedMatrixRow), [matrix]);

  const parentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const row of grantedMatrix) {
      const path = row.parent_path?.trim();
      if (!path) continue;
      const parts = splitPermissionPath(path);
      if (parts[0]) s.add(parts[0]);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [grantedMatrix]);

  const filteredMatrix = useMemo(() => {
    const p = filterParent.trim();
    const q = tableSearch.trim().toLowerCase();
    return grantedMatrix.filter((row) => {
      if (p) {
        const path = row.parent_path?.trim() || "";
        const parts = splitPermissionPath(path);
        if (parts[0] !== p && path !== p) return false;
      }
      if (!matchesPermissionSourceFilter(row, filterSource)) return false;
      if (q) {
        const hay = `${row.key} ${row.description ?? ""} ${row.parent_path} ${row.section ?? ""} ${permissionSourceLabel(row)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [grantedMatrix, filterParent, filterSource, tableSearch]);

  const tableMatrix = useMemo(
    () => filteredMatrix.filter((row) => !suppressedMatrixKeys.has(row.key)),
    [filteredMatrix, suppressedMatrixKeys]
  );

  const sortedFilteredMatrix = useMemo(() => {
    if (!matrixSort) return tableMatrix;
    return [...tableMatrix].sort((a, b) => compareMatrixRows(a, b, matrixSort.key, matrixSort.dir));
  }, [tableMatrix, matrixSort]);

  const matrixRowGroups = useMemo(() => {
    /** L1 = modul (Заявки), L2 = bo‘lim (Возврат) — eski tekis «Заявки · Возврат» o‘rniga. */
    type L2 = { id: string; label: string; parent: string; rows: MatrixRow[] };
    type L1 = { id: string; label: string; parent: string; rows: MatrixRow[]; children: L2[] };
    const roots = new Map<string, { label: string; id: string; rows: MatrixRow[]; children: Map<string, L2> }>();

    for (const row of sortedFilteredMatrix) {
      const path = row.parent_path?.trim() || "—";
      const parts = splitPermissionPath(path);
      const l1Label = parts[0] ?? "—";
      let root = roots.get(l1Label);
      if (!root) {
        root = { label: l1Label, id: l1Label, rows: [], children: new Map() };
        roots.set(l1Label, root);
      }
      if (parts.length <= 1) {
        root.rows.push(row);
        continue;
      }
      const l2Label = parts.slice(1).join(" · ");
      const l2Id = `${l1Label}\u0001${l2Label}`;
      let child = root.children.get(l2Label);
      if (!child) {
        child = { id: l2Id, label: l2Label, parent: l2Id, rows: [] };
        root.children.set(l2Label, child);
      }
      child.rows.push(row);
    }

    const keys = [...roots.keys()].sort((a, b) => matrixCollator.compare(a, b));
    return keys
      .map((k) => {
        const r = roots.get(k)!;
        const children = [...r.children.values()].sort((a, b) => matrixCollator.compare(a.label, b.label));
        const allRows = [...r.rows, ...children.flatMap((c) => c.rows)];
        return {
          id: r.id,
          label: r.label,
          parent: r.id,
          rows: allRows,
          directRows: r.rows,
          children
        } satisfies {
          id: string;
          label: string;
          parent: string;
          rows: MatrixRow[];
          directRows: MatrixRow[];
          children: L2[];
        };
      })
      .filter((g) => g.rows.length > 0);
  }, [sortedFilteredMatrix]);

  const matrixParentKeysSig = useMemo(
    () =>
      JSON.stringify(
        matrixRowGroups.flatMap((g) => [g.parent, ...g.children.map((c) => c.parent)])
      ),
    [matrixRowGroups]
  );
  /** По умолчанию все группы свёрнуты; «Развернуть» в фильтре или шеврон у группы. */
  useEffect(() => {
    setMatrixGroupExpanded(new Set());
  }, [userId, matrixParentKeysSig]);

  const matrixExpandableKeys = useMemo(
    () => matrixRowGroups.flatMap((g) => [g.parent, ...g.children.map((c) => c.parent)]),
    [matrixRowGroups]
  );

  const matrixGroupsAllExpanded = useMemo(
    () =>
      matrixExpandableKeys.length > 0 && matrixExpandableKeys.every((k) => matrixGroupExpanded.has(k)),
    [matrixExpandableKeys, matrixGroupExpanded]
  );

  const toggleMatrixGroupsExpandCollapse = useCallback(() => {
    if (matrixExpandableKeys.length === 0) return;
    setMatrixGroupExpanded((prev) => {
      const allOpen = matrixExpandableKeys.every((k) => prev.has(k));
      if (allOpen) return new Set<string>();
      return new Set(matrixExpandableKeys);
    });
  }, [matrixExpandableKeys]);

  const toggleMatrixSort = (key: MatrixSortKey) => {
    setMatrixSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  /** Тяжёлый фильтр списка не блокирует ввод в «Поиск». */
  const deferredStaffSearch = useDeferredValue(modalSearch);

  const staffPickFilteredFlat = useMemo(() => {
    if (modal !== "staff" || !supervisorPickQ.data?.length) return [];
    const q = deferredStaffSearch.trim().toLowerCase();
    let rows = supervisorPickQ.data.filter((u) => u.id !== userId);
    if (q) {
      rows = rows.filter((u) => {
        const hay = `${u.id} ${u.full_name ?? ""} ${u.code ?? ""} ${u.role} ${u.branch ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (showSelOnly) rows = rows.filter((u) => modalSel.has(String(u.id)));
    return rows;
  }, [modal, supervisorPickQ.data, userId, deferredStaffSearch, showSelOnly, modalSel]);

  const staffPickByRole = useMemo(() => {
    const by = new Map<string, SupervisorPickRow[]>();
    for (const u of staffPickFilteredFlat) {
      const role = u.role?.trim() || "—";
      const arr = by.get(role) ?? [];
      arr.push(u);
      by.set(role, arr);
    }
    for (const arr of Array.from(by.values())) {
      arr.sort((a: SupervisorPickRow, b: SupervisorPickRow) => a.id - b.id);
    }
    return sortStaffRoleKeys([...Array.from(by.keys())]).map((role) => ({ role, items: by.get(role) ?? [] }));
  }, [staffPickFilteredFlat]);

  const visibleStaffPickIds = useMemo(
    () => staffPickFilteredFlat.map((u) => String(u.id)),
    [staffPickFilteredFlat]
  );

  /** Первый запрос без кеша (после prefetch обычно сразу есть data). */
  const staffPickBootstrapping = Boolean(!supervisorPickQ.data && supervisorPickQ.isFetching);

  useEffect(() => {
    if (modal !== "staff") return;
    if (!supervisorPickQ.data?.length) return;
    const session = staffModalSessionRef.current;
    if (staffExpandAppliedForSessionRef.current === session) return;
    staffExpandAppliedForSessionRef.current = session;
    /** По умолчанию роли в модалке свёрнуты; «Развернуть все» — вручную. */
    setStaffRoleExpanded([]);
  }, [modal, userId, supervisorPickQ.data]);

  useEffect(() => {
    if (modal !== "staff" || !staffOpenedBeforeDetailRef.current || !detailQ.data) return;
    setModalSel(new Set(detailQ.data.supervisees.map((s) => String(s.id))));
    staffOpenedBeforeDetailRef.current = false;
  }, [modal, detailQ.data]);

  const toggleExpandCollapseStaffRoles = useCallback(() => {
    setStaffRoleExpanded((prev) => {
      const rolesFromView = uniqRoleKeys(staffPickByRole.map((g) => g.role));
      if (rolesFromView.length === 0) return prev;
      const allInView = rolesFromView.every((r) => prev.includes(r));
      if (allInView) return [];
      return rolesFromView;
    });
    staffExpandAppliedForSessionRef.current = staffModalSessionRef.current;
  }, [staffPickByRole]);

  const allStaffGroupsInViewExpanded =
    staffPickByRole.length > 0 && staffPickByRole.every((g) => staffRoleExpanded.includes(g.role));

  const detachableKeys = useMemo(
    () => tableMatrix.filter((r) => r.effective).map((r) => r.key),
    [tableMatrix]
  );

  const isRowBulkSelectable = useCallback((row: MatrixRow) => isMatrixRowBulkSelectable(row), []);

  const bulkSelectableKeys = useMemo(
    () => tableMatrix.filter(isRowBulkSelectable).map((r) => r.key),
    [tableMatrix, isRowBulkSelectable]
  );

  const selectedDetachableCount = useMemo(
    () => Array.from(bulkSel).filter((k) => detachableKeys.includes(k)).length,
    [bulkSel, detachableKeys]
  );

  const filterResetSig = `${userId}|${filterParent}|${filterSource}`;
  const prevFilterResetSigRef = useRef(filterResetSig);

  /** Сброс выделения при смене пользователя/фильтров; иначе — убрать из выделения строки вне текущей таблицы (поиск и т.д.). */
  useEffect(() => {
    if (prevFilterResetSigRef.current !== filterResetSig) {
      prevFilterResetSigRef.current = filterResetSig;
      setBulkSel(new Set());
      return;
    }
    setBulkSel((prev) => {
      if (prev.size === 0) return prev;
      const allowed = new Set(bulkSelectableKeys);
      const next = new Set<string>();
      const prevArr = Array.from(prev);
      for (let i = 0; i < prevArr.length; i++) {
        const k = prevArr[i]!;
        if (allowed.has(k)) next.add(k);
      }
      if (next.size === prev.size && prevArr.every((k) => next.has(k))) return prev;
      return next;
    });
  }, [filterResetSig, tableSearch, bulkSelectableKeys]);

  useEffect(() => {
    if (!bulkFeedback) return;
    const t = window.setTimeout(() => setBulkFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [bulkFeedback]);

  const bulkHeaderAllSelected =
    bulkSelectableKeys.length > 0 && bulkSelectableKeys.every((k) => bulkSel.has(k));
  const bulkHeaderSomeSelected =
    bulkSelectableKeys.length > 0 && bulkSelectableKeys.some((k) => bulkSel.has(k)) && !bulkHeaderAllSelected;

  useEffect(() => {
    const el = bulkHeaderCheckboxRef.current;
    if (el) el.indeterminate = bulkHeaderSomeSelected;
  }, [bulkHeaderSomeSelected]);

  const grantHeaderAllOn =
    tableMatrix.length > 0 && tableMatrix.every((r) => r.can_grant_others);
  const grantHeaderSomeOn =
    tableMatrix.length > 0 && tableMatrix.some((r) => r.can_grant_others) && !grantHeaderAllOn;

  useEffect(() => {
    const el = grantHeaderSwitchRef.current;
    if (el) el.indeterminate = grantHeaderSomeOn;
  }, [grantHeaderSomeOn]);

  const bulkApplyGrantDelegation = async (wantGrant: boolean) => {
    const targetRows =
      bulkSel.size > 0 ? tableMatrix.filter((r) => bulkSel.has(r.key)) : tableMatrix;
    if (!targetRows.length) return;
    const bodies = chunkGrantDelegationPatchBodies(targetRows, wantGrant);
    if (!bodies.length) {
      setBulkFeedback({ tone: "ok", text: "Изменений не требуется" });
      return;
    }
    const changedCount = grantDelegationKeysNeedingChange(targetRows, wantGrant).length;
    const changedKeys = grantDelegationKeysNeedingChange(targetRows, wantGrant);
    qc.setQueryData<DetailResponse>(["access-user-detail", tenantSlug, userId], (old) =>
      applyGrantDelegationDetailCache(
        old,
        wantGrant ? changedKeys : [],
        wantGrant ? [] : changedKeys
      )
    );
    try {
      for (const body of bodies) {
        await patchMut.mutateAsync(body);
      }
      await qc.refetchQueries({ queryKey: ["access-user-detail", tenantSlug, userId] });
      setBulkFeedback({
        tone: "ok",
        text: wantGrant
          ? bulkSel.size > 0
            ? `Может выдавать другим — для выбранных (${changedCount})`
            : `Может выдавать другим — для всех видимых (${changedCount})`
          : bulkSel.size > 0
            ? `Снято право выдачи — для выбранных (${changedCount})`
            : `Снято право выдачи — для всех видимых (${changedCount})`
      });
    } catch (err) {
      setBulkFeedback({
        tone: "err",
        text: userMessageAfterAccessPatchFailure(err, "Не удалось изменить право выдачи доступа")
      });
    }
  };

  const bulkApplyFilteredEffective = async (wantEffective: boolean) => {
    const targetRows = bulkSel.size > 0 ? tableMatrix.filter((r) => bulkSel.has(r.key)) : tableMatrix;
    if (!targetRows.length) return;
    const body = buildBulkEffectivePatchBody(targetRows, wantEffective);
    if (!body) {
      setBulkFeedback({ tone: "ok", text: "Изменений не требуется" });
      return;
    }
    try {
      await patchMut.mutateAsync(body);
      setBulkFeedback({
        tone: "ok",
        text: wantEffective
          ? bulkSel.size > 0
            ? `Доступ разрешён для выбранных (${targetRows.length}), одним запросом`
            : "Доступ разрешён для всех видимых операций, одним запросом"
          : bulkSel.size > 0
            ? `Доступ изменён для выбранных (${targetRows.length}), одним запросом`
            : "Доступ изменён для всех видимых операций, одним запросом"
      });
    } catch (err) {
      setBulkFeedback({ tone: "err", text: userMessageAfterAccessPatchFailure(err, "Не удалось применить массово") });
    }
  };

  const bulkDetach = async () => {
    const rows = Array.from(bulkSel)
      .map((k) => matrix.find((x) => x.key === k))
      .filter((r): r is MatrixRow => Boolean(r && r.effective));
    if (!rows.length) return;

    const remove_permission_keys: string[] = [];
    const denied_permissions: string[] = [];
    for (const row of rows) {
      const patch = buildRevokeEffectiveAccessPatch(row);
      if (!patch) continue;
      const rm = patch.remove_permission_keys as string[] | undefined;
      const den = patch.denied_permissions as string[] | undefined;
      if (rm?.length) remove_permission_keys.push(...rm);
      if (den?.length) denied_permissions.push(...den);
    }

    const body: Record<string, unknown> = {};
    if (remove_permission_keys.length) body.remove_permission_keys = [...new Set(remove_permission_keys)];
    if (denied_permissions.length) {
      body.merge_permissions = true;
      body.denied_permissions = [...new Set(denied_permissions)];
    }
    if (!body.remove_permission_keys && !body.merge_permissions) return;

    try {
      await patchMut.mutateAsync(body);
      setBulkSel(new Set());
      setBulkFeedback({
        tone: "ok",
        text:
          remove_permission_keys.length && denied_permissions.length
            ? `Снято: ${remove_permission_keys.length} личных и ${denied_permissions.length} из роли (только для пользователя)`
            : remove_permission_keys.length
              ? `Снято личных настроек: ${remove_permission_keys.length}`
              : `Запрещено для пользователя (из роли): ${denied_permissions.length}`
      });
    } catch (err) {
      setBulkFeedback({ tone: "err", text: userMessageAfterAccessPatchFailure(err, "Не удалось открепить. Попробуйте ещё раз.") });
    }
  };

  const toggleBulkAll = (checked: boolean) => {
    if (checked) setBulkSel(new Set(bulkSelectableKeys));
    else setBulkSel(new Set());
  };

  const toggleBulkGroup = useCallback(
    (grp: { parent: string; rows: MatrixRow[] }, checked: boolean) => {
      const keys = grp.rows.filter(isRowBulkSelectable).map((r) => r.key);
      if (keys.length === 0) return;
      setBulkSel((prev) => {
        const n = new Set(prev);
        if (checked) for (const k of keys) n.add(k);
        else for (const k of keys) n.delete(k);
        return n;
      });
    },
    [isRowBulkSelectable]
  );

  const openModal = (kind: typeof modal) => {
    setModal(kind);
    setModalSearch("");
    setShowSelOnly(false);
    if (kind === "operations") {
      /** Faqat qo‘shimcha operatsiyalar — hozirgi faol ro‘yxat emas. */
      setModalSel(new Set());
    } else if (kind === "territory" && scope) {
      setModalSel(new Set(scope.territories.map(String)));
    } else if (kind === "cash" && scope) {
      setModalSel(new Set(scope.cash_desks.map(String)));
    } else if (kind === "warehouse" && scope) {
      setModalSel(new Set(scope.warehouses.map(String)));
    } else if (kind === "branch" && scope) {
      setModalSel(new Set(scope.branches));
    } else if (kind === "payment" && scope) {
      setModalSel(new Set(scope.payment_methods));
    } else if (kind === "direction" && scope) {
      setModalSel(new Set((scope.trade_directions ?? []).map(String)));
    } else if (kind === "staff") {
      staffModalSessionRef.current += 1;
      if (detailQ.data) {
        staffOpenedBeforeDetailRef.current = false;
        setModalSel(new Set(detailQ.data.supervisees.map((s) => String(s.id))));
      } else {
        staffOpenedBeforeDetailRef.current = true;
        setModalSel(new Set());
      }
    } else {
      setModalSel(new Set());
    }
  };

  const modalItems = useMemo(() => {
    if (modal === "territory") {
      return (territoriesQ.data?.flat ?? []).map((r: TerritoryApiRow) => ({
        key: r.key,
        label: territoryLeafNameOnly(r),
        sub: ""
      }));
    }
    return (dimQ.data ?? []).map((r) => ({ key: r.key, label: r.label, sub: String(r.attached_users_count) }));
  }, [modal, territoriesQ.data, dimQ.data]);

  /** Modalka «Добавить операции»: faqat hali berilmagan (effective=false) operatsiyalar. */
  const attachModalBaseItems = useMemo((): ModalPickRow[] => {
    if (modal !== "operations") return [];
    return (catalogQ.data?.flat ?? [])
      .filter((r) => !matrixByKey.get(r.key)?.effective)
      .map((r) => {
        const parent = (r.parent_path ?? "").trim();
        const fullLabel = displayAccessDescriptionShort(r.description, r.key);
        // Guruh allaqachon parent ko‘rsatadi — qatorda bo‘lim·amal (yoki to‘liq yo‘l).
        let label = fullLabel;
        if (parent && fullLabel.startsWith(`${parent} · `)) {
          label = fullLabel.slice(parent.length + 3).trim() || fullLabel;
        }
        return {
          key: r.key,
          label,
          /** Qidiruv uchun; UI da ko‘rsatilmaydi. */
          sub: r.key,
          groupKey: parent || "—"
        };
      });
  }, [modal, catalogQ.data, matrixByKey]);

  const filteredAttachModalItems = useMemo((): ModalPickRow[] => {
    const q = modalSearch.trim().toLowerCase();
    let rows = attachModalBaseItems;
    if (q) {
      rows = rows.filter((x) =>
        `${x.key} ${x.label} ${x.sub} ${x.groupKey ?? ""}`.toLowerCase().includes(q)
      );
    }
    if (showSelOnly) rows = rows.filter((x) => modalSel.has(x.key));
    return rows;
  }, [attachModalBaseItems, modalSearch, showSelOnly, modalSel]);

  const filteredModalItems = useMemo((): ModalPickRow[] => {
    const q = modalSearch.trim().toLowerCase();
    let rows: ModalPickRow[] = modalItems;
    if (q) rows = rows.filter((x) => `${x.key} ${x.label} ${x.sub}`.toLowerCase().includes(q));
    if (showSelOnly) rows = rows.filter((x) => modalSel.has(x.key));
    return rows;
  }, [modalItems, modalSearch, showSelOnly, modalSel]);

  const dimPickModal = modal === "cash" || modal === "warehouse" || modal === "branch" || modal === "payment" || modal === "direction";

  const visibleDimPickKeys = useMemo(() => {
    if (!dimPickModal) return [] as string[];
    return filteredModalItems.map((x) => x.key);
  }, [dimPickModal, filteredModalItems]);

  const dimPickAllSelected =
    visibleDimPickKeys.length > 0 && visibleDimPickKeys.every((k) => modalSel.has(k));
  const dimPickSomeSelected =
    visibleDimPickKeys.length > 0 && visibleDimPickKeys.some((k) => modalSel.has(k)) && !dimPickAllSelected;

  const opAttachGroups = useMemo((): OpAttachTreeNode[] => {
    if (modal !== "operations") return [];
    return buildOpAttachTree(filteredAttachModalItems);
  }, [modal, filteredAttachModalItems]);

  const opAttachGroupKeys = useMemo(() => collectOpAttachExpandableIds(opAttachGroups), [opAttachGroups]);
  const allOpAttachGroupsExpanded =
    opAttachGroupKeys.length > 0 && opAttachGroupKeys.every((k) => opAttachGroupExpanded.has(k));

  const opAttachVisibleKeys = useMemo(
    () => filteredAttachModalItems.map((x) => x.key),
    [filteredAttachModalItems]
  );
  const opAttachAllSelected =
    opAttachVisibleKeys.length > 0 && opAttachVisibleKeys.every((k) => modalSel.has(k));
  const opAttachSomeSelected =
    opAttachVisibleKeys.length > 0 &&
    opAttachVisibleKeys.some((k) => modalSel.has(k)) &&
    !opAttachAllSelected;

  useEffect(() => {
    if (modal !== "operations") return;
    setOpAttachGroupExpanded(new Set());
  }, [modal, userId]);

  const toggleOpAttachGroup = useCallback((items: ModalPickRow[], checked: boolean) => {
    setModalSel((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (checked) next.add(item.key);
        else next.delete(item.key);
      }
      return next;
    });
  }, []);

  const toggleOpAttachTreeNode = useCallback((node: OpAttachTreeNode, checked: boolean) => {
    const keys = collectOpAttachLeafKeys(node);
    setModalSel((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (checked) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }, []);

  const selectAllOpAttachVisible = useCallback(() => {
    setModalSel(new Set(opAttachVisibleKeys));
  }, [opAttachVisibleKeys]);

  const clearOpAttachSelection = useCallback(() => {
    setModalSel(new Set());
  }, []);

  const saveModal = async () => {
    if (modal === "operations") {
      const toAdd = normalizeAccessGrantPermissions([...modalSel].map((k) => k.trim()).filter(Boolean));
      if (toAdd.length === 0) {
        setModal(null);
        return;
      }
      try {
        await patchMut.mutateAsync({ merge_permissions: true, permissions: toAdd });
        setBulkFeedback({ tone: "ok", text: `Добавлено дополнительных операций: ${toAdd.length}` });
        setModal(null);
      } catch (err) {
        setBulkFeedback({
          tone: "err",
          text: userMessageAfterAccessPatchFailure(err, "Не удалось добавить операции")
        });
      }
      return;
    } else if (modal === "territory") {
      await patchMut.mutateAsync({
        territory_ids: [...modalSel].map(Number).filter((n) => Number.isInteger(n) && n > 0)
      });
    } else if (modal === "cash") {
      await patchMut.mutateAsync({
        cash_desk_ids: [...modalSel].map(Number).filter((n) => Number.isInteger(n) && n > 0)
      });
    } else if (modal === "warehouse") {
      await patchMut.mutateAsync({
        warehouse_ids: [...modalSel].map(Number).filter((n) => Number.isInteger(n) && n > 0)
      });
    } else if (modal === "branch") {
      await patchMut.mutateAsync({
        branch_codes: [...modalSel].map((x) => String(x).trim()).filter(Boolean)
      });
    } else if (modal === "payment") {
      await patchMut.mutateAsync({
        payment_methods: [...modalSel].map((x) => String(x).trim()).filter(Boolean)
      });
    } else if (modal === "direction") {
      await patchMut.mutateAsync({
        trade_direction_ids: [...modalSel].map(Number).filter((n) => Number.isInteger(n) && n > 0)
      });
    } else if (modal === "staff") {
      await patchMut.mutateAsync({
        supervisee_user_ids: [...modalSel].map(Number).filter((n) => Number.isInteger(n) && n > 0)
      });
    }
    setModal(null);
  };

  const toggleRowGrantDelegation = useCallback(
    async (row: MatrixRow, next: boolean) => {
      const body = buildGrantDelegationPatchBody([row], next);
      if (!body) return;
      try {
        await patchMut.mutateAsync(body);
        await qc.refetchQueries({ queryKey: ["access-user-detail", tenantSlug, userId] });
      } catch (err) {
        setBulkFeedback({
          tone: "err",
          text: userMessageAfterAccessPatchFailure(err, "Не удалось изменить право выдачи доступа")
        });
      }
    },
    [patchMut, qc, tenantSlug, userId]
  );

  const innerTabs: { id: InnerTab; label: string }[] = [
    { id: "territories", label: "Территории" },
    { id: "staff", label: "Сотрудники" },
    { id: "operations", label: "Операции" },
    { id: "cash_desks", label: "Кассы" },
    { id: "warehouses", label: "Склады" },
    { id: "branches", label: "Филиал" },
    { id: "payment_methods", label: "Способ оплаты" },
    { id: "trade_directions", label: "Направления" }
  ];

  const modalUserLabel = user
    ? user.code
      ? `[${user.code}] • ${user.full_name || user.login}`
      : user.full_name || user.login
    : "";

  const modalTitle =
    modal === "operations"
      ? `Добавить операции: ${modalUserLabel}`
      : modal === "territory" || modal === "staff"
        ? ""
        : modal === "cash"
          ? `Прикрепить кассу: ${modalUserLabel}`
          : modal === "warehouse"
            ? `Прикрепить склад: ${modalUserLabel}`
            : modal === "branch"
              ? `Прикрепить филиал: ${modalUserLabel}`
              : modal === "payment"
                ? `Прикрепить способ оплаты: ${modalUserLabel}`
                : modal === "direction"
                  ? `Прикрепить направление: ${modalUserLabel}`
                  : "";

  /** Модалки выбора привязок (как «Территории»): оверлей поверх матрицы, единый шаблон шапки и списка. */
  const assignPickModal =
    modal === "territory" ||
    modal === "staff" ||
    modal === "cash" ||
    modal === "warehouse" ||
    modal === "branch" ||
    modal === "payment" ||
    modal === "direction";
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
    grantedMatrixCount: grantedMatrix.length,
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
    opAttachGroupExpanded,
    setOpAttachGroupExpanded,
    toggleOpAttachGroup,
    toggleOpAttachTreeNode,
    selectAllOpAttachVisible,
    clearOpAttachSelection,
    opAttachAllSelected,
    opAttachSomeSelected,
    opAttachVisibleKeys,
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
