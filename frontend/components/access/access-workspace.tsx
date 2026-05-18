"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, ChevronsDownUp, Loader2, Search } from "lucide-react";
import { TableSortButton, type TableSortDir } from "@/components/ui/table-sort-button";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  SearchableMultiSelectPanel,
  type SearchableMultiSelectItem
} from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import { AccessUserDetailPanel } from "@/components/access/access-user-detail-panel";

function formatAccessFilterTriggerSummary<T extends string | number>(
  allLabel: string,
  selected: Set<T>,
  items: SearchableMultiSelectItem<T>[]
): string {
  if (selected.size === 0) return allLabel;
  const titles: string[] = [];
  for (const it of items) {
    if (selected.has(it.id)) titles.push(it.title);
  }
  if (titles.length === 0) return allLabel;
  const [first, ...more] = titles;
  return more.length > 0 ? `${first} +${more.length}` : first;
}

const OP_GRANT_FILTER_ITEMS: SearchableMultiSelectItem<string>[] = [
  { id: "allowed", title: "Разрешено" },
  { id: "denied", title: "Запрещено" }
];

const OP_ACTIVITY_FILTER_ITEMS: SearchableMultiSelectItem<string>[] = [
  { id: "active", title: "Активные" },
  { id: "inactive", title: "Неактивные" }
];

/** Qanchadan ko‘p variant bo‘lsa, ochilganda qidiruv ko‘rinadi. */
const ACCESS_FILTER_MULTI_SEARCH_MIN = 8;

function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className,
  title,
  "aria-label": ariaLabel
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      checked={checked}
      onChange={onChange}
      title={title}
      aria-label={ariaLabel}
      className={cn("mt-0.5 h-4 w-4 shrink-0 accent-teal-700", className)}
    />
  );
}

const ACCESS_MODAL_ROLE_ORDER = ["admin", "supervisor", "agent", "expeditor", "operator", "manager"];

function accessModalRoleGroupLabel(role: string): string {
  const r = role.toLowerCase().trim();
  const map: Record<string, string> = {
    admin: "Администраторы",
    supervisor: "Супервайзеры",
    agent: "Агенты",
    expeditor: "Экспедиторы",
    manager: "Менеджеры",
    operator: "Операторы"
  };
  return map[r] ?? role;
}

function sortAccessModalRoleKeys(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    const ia = ACCESS_MODAL_ROLE_ORDER.indexOf(la);
    const ib = ACCESS_MODAL_ROLE_ORDER.indexOf(lb);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, "ru", { sensitivity: "base", numeric: true });
  });
}

/** Jadval qatori balandligi (virtualizatsiya) — taxminiy, DOM yuki kamayadi. */
const ACCESS_DIM_TABLE_ROW_ESTIMATE_PX = 46;

type AccessUserRow = {
  id: number;
  login: string;
  full_name: string;
  role: string;
  status: "active" | "inactive";
  operations_count: number;
  branch: string | null;
  code: string | null;
  /** GET /access/users?include_access_manage=true — «Предоставление доступа» / modal. */
  has_access_manage?: boolean;
  scope?: {
    branches: string[];
    warehouses: number[];
    /** Omborlar, bo‘yicha boshqa foydalanuvchilarni biriktirish huquqi (`manager`). */
    warehouse_delegate_ids?: number[];
    cash_desks: number[];
    payment_methods: string[];
    territories: number[];
  };
};

type DimensionUserRow = {
  id: number;
  login: string;
  full_name: string;
  code: string | null;
  role: string;
  position?: string | null;
  is_active: boolean;
  from_direct_allow?: boolean;
  from_direct_deny?: boolean;
  from_role?: boolean;
  source?: string;
  /** «Доступ: управление» — boshqa operatsiyalar / omborni boshqalarga biriktirish. */
  has_access_manage?: boolean;
  /** Faqat `dimensions/users` + `warehouses`: `manager` — boshqalarga biriktirish; `operator` — faqat o‘zi. */
  warehouse_link_role?: string | null;
};

const ACCESS_MANAGE_KEY = "access.manage";

/** PATCH kutilganda dimension-users keshini bitta qator uchun yangilash. */
function applyOptimisticOperationDimPatch(
  row: DimensionUserRow,
  body: Record<string, unknown>,
  permissionKey: string
): DimensionUserRow {
  const rm = (body.remove_permission_keys as string[] | undefined) ?? [];
  if (rm.includes(permissionKey)) {
    return { ...row, from_direct_allow: false, from_direct_deny: false };
  }
  const den = (body.denied_permissions as string[] | undefined) ?? [];
  if (body.merge_permissions === true && den.includes(permissionKey)) {
    return { ...row, from_direct_allow: false, from_direct_deny: true };
  }
  const perms = (body.permissions as string[] | undefined) ?? [];
  if (body.merge_permissions === true && perms.includes(permissionKey)) {
    return { ...row, from_direct_allow: true, from_direct_deny: false };
  }
  return row;
}

const dimUserCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

function dimUserDisplayName(u: DimensionUserRow): string {
  return u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login;
}

type DimUserSortKey = "name" | "role" | "position" | "status";

function sortDimUserRows(
  rows: DimensionUserRow[],
  sort: { key: DimUserSortKey; dir: TableSortDir } | null
): DimensionUserRow[] {
  if (!sort) return rows;
  const mult = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let c = 0;
    if (sort.key === "name") c = dimUserCollator.compare(dimUserDisplayName(a), dimUserDisplayName(b)) * mult;
    else if (sort.key === "role") c = dimUserCollator.compare(a.role ?? "", b.role ?? "") * mult;
    else if (sort.key === "position") c = dimUserCollator.compare(a.position ?? "", b.position ?? "") * mult;
    else c = dimUserCollator.compare(a.is_active ? "1" : "0", b.is_active ? "1" : "0") * mult;
    if (c !== 0) return c;
    return a.id - b.id;
  });
}

/** Sticky thead + scroll tbody: bir xil `colgroup` — ustunlar surilmasin. */
function AccessDimUsersColGroup() {
  return (
    <colgroup>
      <col className="w-8" />
      <col className="min-w-[14rem]" />
      <col className="w-28" />
      <col className="w-32" />
      <col className="w-24" />
      <col className="w-24" />
    </colgroup>
  );
}

type SideRow = {
  key: string;
  title: string;
  subtitle: string;
  meta: string;
  idLine: string | null;
  is_active: boolean;
  group: string;
  subgroup: string | null;
};

function normalizeOperationSegment(value: string): string {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower === "дашбоард" || lower === "дашборд") return "Дашборд";
  return normalized;
}

function parseOperationLabelParts(
  rawLabel: string,
  fallbackKey: string
): { group: string; subgroup: string | null; title: string } {
  const normalized = String(rawLabel || "").trim();
  if (normalized) {
    const slashParts = normalized
      .split("/")
      .map((x) => normalizeOperationSegment(x))
      .filter(Boolean);
    if (slashParts.length >= 3) {
      const group = slashParts[0] ?? "general";
      const subgroupRaw = slashParts[1] ?? "common";
      const subgroup = subgroupRaw === group ? null : subgroupRaw;
      return {
        group,
        subgroup,
        title: slashParts[slashParts.length - 1]!
      };
    }
    if (slashParts.length >= 2) {
      const group = slashParts[0] ?? "general";
      const subgroupRaw = slashParts[1] ?? null;
      const subgroup = subgroupRaw && subgroupRaw !== group ? subgroupRaw : null;
      return {
        group,
        subgroup,
        title: slashParts[slashParts.length - 1]!
      };
    }
    const colonParts = normalized
      .split(":")
      .map((x) => normalizeOperationSegment(x))
      .filter(Boolean);
    if (colonParts.length >= 2) {
      return {
        group: colonParts[0] ?? "general",
        subgroup: null,
        title: colonParts.slice(1).join(": ")
      };
    }
  }
  const keyParts = String(fallbackKey || "").split(".").map((x) => x.trim()).filter(Boolean);
  if (keyParts.length >= 3) {
    const group = normalizeOperationSegment(keyParts[0] ?? "general");
    const subgroupRaw = normalizeOperationSegment(keyParts[1] ?? "common");
    const subgroup = subgroupRaw === group ? null : subgroupRaw;
    return {
      group,
      subgroup,
      title: keyParts[keyParts.length - 1]!
    };
  }
  if (keyParts.length >= 2) {
    const group = normalizeOperationSegment(keyParts[0] ?? "general");
    const subgroupRaw = normalizeOperationSegment(keyParts[1] ?? "");
    const subgroup = subgroupRaw && subgroupRaw !== group ? subgroupRaw : null;
    return {
      group,
      subgroup,
      title: keyParts[keyParts.length - 1]!
    };
  }
  const fallback = normalizeOperationSegment(normalized || fallbackKey || "Операция");
  return { group: "general", subgroup: null, title: fallback };
}

type ScopeDimensionTab = "cash_desks" | "warehouses" | "branches" | "payment_methods";

function buildScopeDimensionPatchBody(
  kind: ScopeDimensionTab,
  selectedScopeKey: string,
  u: AccessUserRow,
  want: boolean
): Record<string, unknown> | null {
  if (kind === "cash_desks") {
    const cashDeskId = Number(selectedScopeKey);
    if (!Number.isInteger(cashDeskId) || cashDeskId < 1) return null;
    const currentCashDeskIds = Array.from(
      new Set((u.scope?.cash_desks ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
    );
    const hasCurrent = currentCashDeskIds.includes(cashDeskId);
    if (want === hasCurrent) return null;
    return {
      cash_desk_ids: want
        ? Array.from(new Set([...currentCashDeskIds, cashDeskId]))
        : currentCashDeskIds.filter((id) => id !== cashDeskId)
    };
  }
  if (kind === "warehouses") {
    const warehouseId = Number(selectedScopeKey);
    if (!Number.isInteger(warehouseId) || warehouseId < 1) return null;
    const currentWarehouseIds = Array.from(
      new Set((u.scope?.warehouses ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
    );
    const hasCurrent = currentWarehouseIds.includes(warehouseId);

    if (want === hasCurrent) return null;
    return {
      warehouse_ids: want
        ? Array.from(new Set([...currentWarehouseIds, warehouseId]))
        : currentWarehouseIds.filter((id) => id !== warehouseId)
    };
  }
  if (kind === "branches") {
    const currentBranches = Array.from(new Set((u.scope?.branches ?? []).map((x) => String(x).trim()).filter(Boolean)));
    const hasCurrent = currentBranches.includes(selectedScopeKey);
    if (want === hasCurrent) return null;
    return {
      branch_codes: want
        ? Array.from(new Set([...currentBranches, selectedScopeKey]))
        : currentBranches.filter((id) => id !== selectedScopeKey)
    };
  }
  const currentMethods = Array.from(new Set((u.scope?.payment_methods ?? []).map((x) => String(x).trim()).filter(Boolean)));
  const hasCurrent = currentMethods.includes(selectedScopeKey);
  if (want === hasCurrent) return null;
  return {
    payment_methods: want
      ? Array.from(new Set([...currentMethods, selectedScopeKey]))
      : currentMethods.filter((id) => id !== selectedScopeKey)
  };
}

function scopeUserHasObjectAttachment(kind: ScopeDimensionTab, selectedScopeKey: string, u: AccessUserRow): boolean {
  return buildScopeDimensionPatchBody(kind, selectedScopeKey, u, false) !== null;
}

type AccessBulkPatchItem = Record<string, unknown> & { user_id: number };

/** Одна проходка для модалки «Прикрепление к объекту»: payload + число строк, отфильтрованных из‑за `access.manage`. */
function collectScopeDimensionModalBulkItems(
  kind: ScopeDimensionTab,
  selectedScopeKey: string,
  opModalUsers: AccessUserRow[],
  opUsersModalSelected: Set<number>
): { items: AccessBulkPatchItem[]; skippedAttachNoAccessManage: number } {
  const items: AccessBulkPatchItem[] = [];
  const skippedAttachNoAccessManage = 0;
  for (const u of opModalUsers) {
    const want = opUsersModalSelected.has(u.id);
    const body = buildScopeDimensionPatchBody(kind, selectedScopeKey, u, want);
    if (!body) continue;
    items.push({ user_id: u.id, ...body });
  }
  return { items, skippedAttachNoAccessManage };
}

function accessWorkspaceUserPickerModalTitle(
  usersModalKind: "operations" | "cash_desks" | "warehouses" | "branches" | "payment_methods",
  objectLabel: string | undefined
): string {
  const suffix = objectLabel ? `: ${objectLabel}` : "";
  switch (usersModalKind) {
    case "operations":
      return `Доступ к операции${suffix}`;
    case "cash_desks":
      return `Прикрепить к кассе${suffix}`;
    case "warehouses":
      return `Прикрепить к складу${suffix}`;
    case "branches":
      return `Прикрепить к филиалу${suffix}`;
    case "payment_methods":
      return `Прикрепить к способу оплаты${suffix}`;
    default:
      return `Прикрепить пользователей${suffix}`;
  }
}

/** Как в модалке супервайзера: имя + код + филиал одной строкой для title, две строки в UI. */
function accessModalUserPrimaryLine(u: AccessUserRow): string {
  const name = (u.full_name || u.login || "").trim();
  const code = u.code?.trim();
  if (code) return `[${code}] ${name || u.login}`.trim();
  return name || u.login;
}

function accessModalUserBranchLine(u: AccessUserRow): string | null {
  const b = u.branch?.trim();
  return b ? b : null;
}

export function AccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "operations" | "cash_desks" | "warehouses" | "branches" | "payment_methods">("users");
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
  const [usersModalKind, setUsersModalKind] = useState<
    "operations" | "cash_desks" | "warehouses" | "branches" | "payment_methods"
  >("operations");
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
    (tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods") && Boolean(selectedKey);

  const allUsersForOperationModalQ = useQuery({
    queryKey: ["access-users-for-operation-modal", tenantSlug],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    enabled:
      Boolean(tenantSlug) &&
      (scopeTabsNeedFullUserScope ||
        (tab === "operations" && Boolean(selectedKey)) ||
        (opUsersModalOpen &&
          (tab === "operations" || tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods"))),
    queryFn: async () => {
      const { data } = await api.get<{ data: AccessUserRow[] }>(
        `/api/${tenantSlug}/access/users?include_counts=false&include_access_manage=true`
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["access-users", tenantSlug] });
    }
  });

  type OpAccessMutCtx = {
    previous: DimensionUserRow[] | null;
    /** `["access-dimension-users", tenantSlug, tab, dimensionKey]` */
    qk: readonly [string, string, string, string | undefined];
  };

  const operationAccessMut = useMutation({
    mutationFn: async ({ userId, body }: { userId: number; body: Record<string, unknown> }) => {
      await api.patch(`/api/${tenantSlug}/access/users/${userId}`, body);
    },
    onMutate: async ({ userId, body }): Promise<OpAccessMutCtx> => {
      if (tab !== "operations" || !selectedDimension?.key) {
        return { previous: null, qk: ["access-dimension-users", tenantSlug, tab, selectedDimension?.key] };
      }
      const qk = ["access-dimension-users", tenantSlug, tab, selectedDimension.key] as const;
      await qc.cancelQueries({ queryKey: qk });
      const previous = qc.getQueryData<DimensionUserRow[]>(qk) ?? null;
      if (previous) {
        const pk = selectedDimension.key;
        qc.setQueryData(
          qk,
          previous.map((r) => (r.id === userId ? applyOptimisticOperationDimPatch(r, body, pk) : r))
        );
      }
      return { previous, qk };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as OpAccessMutCtx | undefined;
      if (c?.previous && c.qk[2] === "operations") {
        qc.setQueryData(c.qk, c.previous);
      }
    },
    onSuccess: async (_data, _vars, ctx) => {
      const c = ctx as OpAccessMutCtx | undefined;
      if (c?.qk[2] === "operations") {
        /** Modal yopiq bo‘lsa — qo‘shimcha GET shart emas. */
        return;
      }
      await invalidateAccessWorkspaceCaches();
    }
  });

  const opDimAccessBusyUserId =
    operationAccessMut.isPending && operationAccessMut.variables
      ? operationAccessMut.variables.userId
      : null;

  function getOpEffective(u: DimensionUserRow): boolean {
    if (u.from_direct_deny) return false;
    return Boolean(u.from_direct_allow || u.from_role);
  }

  function getOpPatchBodyForToggle(u: DimensionUserRow, next: boolean, permissionKey: string): Record<string, unknown> | null {
    const effective = getOpEffective(u);
    if (effective === next) return null;
    if (next) {
      /** Только `remove` при deny поверх роли; без роли deny → снова включить через `merge allow`. */
      if (u.from_direct_deny && u.from_role) return { remove_permission_keys: [permissionKey] };
      if (u.from_direct_deny) return { merge_permissions: true, permissions: [permissionKey], denied_permissions: [] };
      return { merge_permissions: true, permissions: [permissionKey], denied_permissions: [] };
    }
    return { merge_permissions: true, permissions: [], denied_permissions: [permissionKey] };
  }

  const rows = useMemo(() => usersQ.data ?? [], [usersQ.data]);
  const selected = useMemo(
    () => rows.find((r) => String(r.id) === selectedKey) ?? null,
    [rows, selectedKey]
  );

  const [, startListNavTransition] = useTransition();
  /** `startTransition` bu yerda tanlovni kechiktiradi — katta jadvalda 5–7s «tovlash» kabi. */
  const selectSideRowKey = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  const sideRows = useMemo((): SideRow[] => {
    if (tab === "users") {
      return rows.map((r) => ({
        key: String(r.id),
        title: r.code ? `[${r.code}] ${r.full_name || r.login}` : r.full_name || r.login,
        subtitle: `${r.role} · ${r.operations_count} операций`,
        meta: r.status === "active" ? "Активный" : "Неактивный",
        idLine: String(r.id),
        is_active: r.status === "active",
        group: (r.role && String(r.role).trim()) || "Без роли",
        subgroup: null
      }));
    }
    return (dimensionsQ.data ?? []).map((r) => {
      const operationLabel = tab === "operations" ? parseOperationLabelParts(r.label, r.key) : null;
      return {
        key: r.key,
        title: operationLabel ? operationLabel.title : r.label,
        subtitle: `${r.attached_users_count} пользователей прикреплено`,
        meta: r.is_active ? "Активный" : "Неактивный",
        idLine: null as string | null,
        is_active: r.is_active,
        group: operationLabel ? operationLabel.group : "common",
        subgroup: operationLabel?.subgroup ?? null
      };
    });
  }, [tab, rows, dimensionsQ.data]);

  const filteredSideRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sideRows.filter((r) => {
      const matchesSearch = !q || `${r.title} ${r.subtitle}`.toLowerCase().includes(q);
      const matchesStatus = status === "active" ? r.is_active : !r.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [sideRows, search, status]);

  function isNestedOperationRow(row: SideRow): boolean {
    return tab === "operations" && Boolean(row.subgroup);
  }

  const groupedFilteredSideRows = useMemo(() => {
    const m = new Map<string, SideRow[]>();
    for (const r of filteredSideRows) {
      const k = r.group || "Прочее";
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([group, items]: [string, SideRow[]]) => ({ group, items }));
  }, [filteredSideRows]);

  const operationNestedGroups = useMemo(() => {
    if (tab !== "operations") return [] as Array<{ group: string; subgroups: Array<{ subgroup: string; items: SideRow[] }> }>;
    const groupMap = new Map<string, Map<string, SideRow[]>>();
    for (const row of filteredSideRows) {
      const first = row.group || "Прочее";
      const second = row.subgroup || "Прочее";
      const nested = groupMap.get(first) ?? new Map<string, SideRow[]>();
      const rowsBySubgroup = nested.get(second) ?? [];
      rowsBySubgroup.push(row);
      nested.set(second, rowsBySubgroup);
      groupMap.set(first, nested);
    }
    return Array.from(groupMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([group, subgroupMap]) => ({
        group,
        subgroups: Array.from(subgroupMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "ru"))
          .map(([subgroup, items]) => ({ subgroup, items }))
      }));
  }, [tab, filteredSideRows]);

  /** Список имён групп слева: при смене набора — все свёрнуты (как матрица «Операции»). */
  const leftPanelGroupListSignature = useMemo(() => {
    if (tab === "operations") {
      return operationNestedGroups.map((g) => g.group).join("\u0001");
    }
    return groupedFilteredSideRows.map((g) => g.group).join("\u0001");
  }, [tab, operationNestedGroups, groupedFilteredSideRows]);

  /** Только имена групп/подгрупп (без строк): не сбрасывать подгруппы на каждый символ поиска. */
  const operationLeftSubgroupStructureSignature = useMemo(() => {
    if (tab !== "operations") return "";
    return operationNestedGroups
      .map((g) => `${g.group}\u0002${g.subgroups.map((s) => s.subgroup).join("\u0003")}`)
      .join("\u0001");
  }, [tab, operationNestedGroups]);

  const selectedDimension = useMemo(() => {
    if (tab === "users") return null;
    return (dimensionsQ.data ?? []).find((r) => r.key === selectedKey) ?? null;
  }, [tab, dimensionsQ.data, selectedKey]);

  const dimensionUsersQ = useQuery({
    queryKey: ["access-dimension-users", tenantSlug, tab, selectedDimension?.key],
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantSlug) && tab !== "users" && Boolean(selectedDimension?.key) && !dimensionUsersApiMissing,
    retry: false,
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ type: tab, key: selectedDimension!.key });
        const { data } = await api.get<{ data: DimensionUserRow[] }>(`/api/${tenantSlug}/access/dimensions/users?${params.toString()}`);
        setDimensionUsersApiMissing(false);
        return data.data;
      } catch (error) {
        const statusCode = (error as { response?: { status?: number } })?.response?.status;
        if (statusCode === 404) {
          setDimensionUsersApiMissing(true);
          return [];
        }
        throw error;
      }
    }
  });

  const prefetchDimensionUsersForKey = useCallback(
    (key: string) => {
      if (!tenantSlug || tab === "users" || dimensionUsersApiMissing) return;
      void qc.prefetchQuery({
        queryKey: ["access-dimension-users", tenantSlug, tab, key],
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        queryFn: async () => {
          const params = new URLSearchParams({ type: tab, key });
          const { data } = await api.get<{ data: DimensionUserRow[] }>(
            `/api/${tenantSlug}/access/dimensions/users?${params.toString()}`
          );
          return data.data ?? [];
        }
      });
    },
    [qc, tenantSlug, tab, dimensionUsersApiMissing]
  );

  useEffect(() => {
    setDimensionUsersApiMissing(false);
  }, [tab, selectedDimension?.key]);

  useEffect(() => {
    if (tab !== "operations") return;
    setOpSearch("");
    setOpFilterRolesDraft(new Set());
    setOpFilterPositionsDraft(new Set());
    setOpFilterGrantsDraft(new Set());
    setOpFilterActivitiesDraft(new Set());
    setOpFilterRoles(new Set());
    setOpFilterPositions(new Set());
    setOpFilterGrants(new Set());
    setOpFilterActivities(new Set());
    setOpRoleFilterSearch("");
    setOpPosFilterSearch("");
    setOpDimBulkSel(new Set());
    setOpDimBulkFeedback(null);
    setOpDimUserSort(null);
  }, [tab, selectedDimension?.key]);

  useEffect(() => {
    if (!(tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods")) return;
    setCashSearch("");
    setCashFilterRolesDraft(new Set());
    setCashFilterPositionsDraft(new Set());
    setCashFilterActivitiesDraft(new Set());
    setCashFilterRoles(new Set());
    setCashFilterPositions(new Set());
    setCashFilterActivities(new Set());
    setCashRoleFilterSearch("");
    setCashPosFilterSearch("");
    setScopeDimBulkSel(new Set());
    setScopeDimBulkFeedback(null);
    setScopeDimUserSort(null);
  }, [tab, selectedDimension?.key]);

  const operationUsers = useMemo(() => {
    if (tab !== "operations") return [] as DimensionUserRow[];
    return dimensionUsersQ.data ?? [];
  }, [tab, dimensionUsersQ.data]);

  const cashUsers = useMemo(() => {
    if (!(tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods")) {
      return [] as DimensionUserRow[];
    }
    return dimensionUsersQ.data ?? [];
  }, [tab, dimensionUsersQ.data]);

  const opModalUsers = useMemo(() => allUsersForOperationModalQ.data ?? [], [allUsersForOperationModalQ.data]);

  const opModalUsersById = useMemo(() => {
    const m = new Map<number, AccessUserRow>();
    for (const u of opModalUsers) m.set(u.id, u);
    return m;
  }, [opModalUsers]);

  /** Har `dimensionUsers` refetchida tanlovni qayta tiklamaslik — aks holda «Выбрать все»dan keyin «Сохранить» bo‘sh qoladi. */
  const operationUsersModalRef = useRef(operationUsers);
  operationUsersModalRef.current = operationUsers;

  useEffect(() => {
    if (!opUsersModalOpen || tab !== "operations") return;
    const next = new Set<number>();
    for (const u of operationUsersModalRef.current) {
      if (getOpEffective(u)) next.add(u.id);
    }
    setOpUsersModalSelected(next);
  }, [opUsersModalOpen, tab, selectedDimension?.key]);

  /**
   * Кассы / склады / филиалы: галочки = фактические привязки из `scope` полного списка пользователей, а не строка
   * `dimensions/users` (она может отставать из‑за keepPreviousData или загрузки).
   */
  useEffect(() => {
    if (!opUsersModalOpen) return;
    if (tab !== "cash_desks" && tab !== "warehouses" && tab !== "branches" && tab !== "payment_methods") return;
    const k = selectedDimension?.key;
    if (!k) return;
    const fullList = allUsersForOperationModalQ.data ?? [];
    if (allUsersForOperationModalQ.isLoading && fullList.length === 0) {
      setOpUsersModalSelected(new Set());
      return;
    }
    const next = new Set<number>();
    for (const u of fullList) {
      if (scopeUserHasObjectAttachment(tab, k, u)) next.add(u.id);
    }
    setOpUsersModalSelected(next);
  }, [
    opUsersModalOpen,
    tab,
    selectedDimension?.key,
    allUsersForOperationModalQ.isLoading,
    allUsersForOperationModalQ.data,
    allUsersForOperationModalQ.dataUpdatedAt
  ]);

  /** Faqat yo‘qolgan rollarni tozalash — «Развернуть все» ni `yangi Set(barcha rollar)` dan keyin qayta qisqartirmaslik. */
  useEffect(() => {
    if (!opUsersModalOpen || tab !== "operations") return;
    const valid = new Set(
      opModalUsers.map((u) => (String(u.role || "").trim() || "Без роли"))
    );
    setOpUsersModalExpandedRoles((prev) => {
      const next = new Set<string>();
      for (const r of prev) {
        if (valid.has(r)) next.add(r);
      }
      if (next.size === prev.size && [...prev].every((r) => next.has(r))) return prev;
      return next;
    });
  }, [opUsersModalOpen, tab, opModalUsers]);

  /** Модалка выбора пользователей — группы по ролям по умолчанию свёрнуты («Развернуть все» по желанию). */
  useEffect(() => {
    if (!opUsersModalOpen) return;
    setOpUsersModalExpandedRoles(new Set());
  }, [opUsersModalOpen, usersModalKind, selectedDimension?.key]);

  const operationRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of operationUsers) {
      const r = String(u.role || "").trim();
      if (r) s.add(r);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [operationUsers]);

  const operationPositionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of operationUsers) {
      const p = String(u.position || "").trim();
      if (p) s.add(p);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [operationUsers]);

  const operationRoleFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] =>
      operationRoleOptions.map((r) => ({ id: r, title: r })),
    [operationRoleOptions]
  );

  const operationPositionFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] =>
      operationPositionOptions.map((p) => ({ id: p, title: p })),
    [operationPositionOptions]
  );

  const cashRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of cashUsers) {
      const r = String(u.role || "").trim();
      if (r) s.add(r);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [cashUsers]);

  const cashPositionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of cashUsers) {
      const p = String(u.position || "").trim();
      if (p) s.add(p);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [cashUsers]);

  const cashRoleFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] => cashRoleOptions.map((r) => ({ id: r, title: r })),
    [cashRoleOptions]
  );

  const cashPositionFilterItems = useMemo(
    (): SearchableMultiSelectItem<string>[] => cashPositionOptions.map((p) => ({ id: p, title: p })),
    [cashPositionOptions]
  );

  const filteredOperationUsers = useMemo(() => {
    if (tab !== "operations") return [] as DimensionUserRow[];
    const q = opSearch.trim().toLowerCase();
    return operationUsers.filter((u) => {
      const roleStr = String(u.role ?? "").trim();
      if (opFilterRoles.size > 0 && !opFilterRoles.has(roleStr)) return false;
      const posStr = String(u.position ?? "").trim();
      if (opFilterPositions.size > 0 && !opFilterPositions.has(posStr)) return false;
      const effective = getOpEffective(u);
      if (
        opFilterGrants.size > 0 &&
        !((opFilterGrants.has("allowed") && effective) || (opFilterGrants.has("denied") && !effective))
      ) {
        return false;
      }
      if (
        opFilterActivities.size > 0 &&
        !((opFilterActivities.has("active") && u.is_active) || (opFilterActivities.has("inactive") && !u.is_active))
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${u.full_name} ${u.login} ${u.code ?? ""} ${u.role} ${u.position ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tab, opSearch, opFilterRoles, opFilterPositions, opFilterGrants, opFilterActivities, operationUsers]);

  const filteredCashUsers = useMemo(() => {
    if (!(tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods")) {
      return [] as DimensionUserRow[];
    }
    const q = cashSearch.trim().toLowerCase();
    return cashUsers.filter((u) => {
      const roleStr = String(u.role ?? "").trim();
      if (cashFilterRoles.size > 0 && !cashFilterRoles.has(roleStr)) return false;
      const posStr = String(u.position ?? "").trim();
      if (cashFilterPositions.size > 0 && !cashFilterPositions.has(posStr)) return false;
      if (
        cashFilterActivities.size > 0 &&
        !(
          (cashFilterActivities.has("active") && u.is_active) ||
          (cashFilterActivities.has("inactive") && !u.is_active)
        )
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${u.full_name} ${u.login} ${u.code ?? ""} ${u.role} ${u.position ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tab, cashSearch, cashFilterRoles, cashFilterPositions, cashFilterActivities, cashUsers]);

  const displayOperationUsers = useMemo(
    () => sortDimUserRows(filteredOperationUsers, opDimUserSort),
    [filteredOperationUsers, opDimUserSort]
  );

  const displayCashUsers = useMemo(
    () => sortDimUserRows(filteredCashUsers, scopeDimUserSort),
    [filteredCashUsers, scopeDimUserSort]
  );

  const opDimRowVirtualizer = useVirtualizer({
    count: tab === "operations" ? displayOperationUsers.length : 0,
    getScrollElement: () => dimTableBodyScrollRef.current,
    estimateSize: () => ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
    overscan: 12
  });

  const scopeDimRowVirtualizer = useVirtualizer({
    count:
      tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods"
        ? displayCashUsers.length
        : 0,
    getScrollElement: () => dimTableBodyScrollRef.current,
    estimateSize: () => ACCESS_DIM_TABLE_ROW_ESTIMATE_PX,
    overscan: 12
  });

  useEffect(() => {
    opDimRowVirtualizer.scrollToOffset(0);
    scopeDimRowVirtualizer.scrollToOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll reset faqat kontekst (tab / tanlangan kalit) almashtirilganda
  }, [selectedKey, tab]);

  const toggleOpDimUserSort = (key: DimUserSortKey) => {
    setOpDimUserSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const toggleScopeDimUserSort = (key: DimUserSortKey) => {
    setScopeDimUserSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const opUsersById = useMemo(() => {
    const m = new Map<number, DimensionUserRow>();
    for (const u of operationUsers) m.set(u.id, u);
    return m;
  }, [operationUsers]);

  type AccessBulkItem = Record<string, unknown> & { user_id: number };

  const { modalBulkItems, scopeModalSkippedAttachNoManage } = useMemo(() => {
    if (!opUsersModalOpen || !selectedDimension) {
      return { modalBulkItems: [] as AccessBulkItem[], scopeModalSkippedAttachNoManage: 0 };
    }
    if (usersModalKind === "operations") {
      const items: AccessBulkItem[] = [];
      const permissionKey = selectedDimension.key;
      for (const u of opModalUsers) {
        const want = opUsersModalSelected.has(u.id);
        const existing = opUsersById.get(u.id);
        if (!existing) {
          if (want) {
            if (permissionKey !== ACCESS_MANAGE_KEY && !u.has_access_manage) continue;
            items.push({
              user_id: u.id,
              merge_permissions: true,
              permissions: [permissionKey],
              denied_permissions: []
            });
          }
          continue;
        }
        const body = getOpPatchBodyForToggle(existing, want, permissionKey);
        if (!body) continue;
        items.push({ user_id: u.id, ...body });
      }
      return { modalBulkItems: items, scopeModalSkippedAttachNoManage: 0 };
    }
    const kind = usersModalKind as ScopeDimensionTab;
    const { items, skippedAttachNoAccessManage } = collectScopeDimensionModalBulkItems(
      kind,
      selectedDimension.key,
      opModalUsers,
      opUsersModalSelected
    );
    return { modalBulkItems: items, scopeModalSkippedAttachNoManage: skippedAttachNoAccessManage };
  }, [opUsersModalOpen, selectedDimension, usersModalKind, opModalUsers, opUsersModalSelected, opUsersById]);

  const modalBulkSummaryText = useMemo(() => {
    if (!opUsersModalOpen || !selectedDimension) return "";
    const n = modalBulkItems.length;
    if (n === 0) {
      if (usersModalKind === "operations") {
        return "Нет отличий от текущего доступа: сохранять нечего.";
      }
      if (scopeModalSkippedAttachNoManage > 0) {
        return `Для ${scopeModalSkippedAttachNoManage} пользов. не применено: «выдавать склад другим» возможно только с «Доступ: управление» (access.manage). Остальные привязки уже совпадают с текущими.`;
      }
      return "Нет отличий от текущих привязок к объекту: сохранять нечего.";
    }
    return `К записи одним запросом на сервер: ${n} ${n === 1 ? "пользователь" : "пользователей"}.`;
  }, [
    opUsersModalOpen,
    selectedDimension,
    usersModalKind,
    modalBulkItems.length,
    scopeModalSkippedAttachNoManage
  ]);

  useEffect(() => {
    setOpDimBulkSel((prev) => {
      if (prev.size === 0) return prev;
      const vis = new Set(filteredOperationUsers.map((u) => u.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (vis.has(id)) next.add(id);
      }
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [filteredOperationUsers]);

  useEffect(() => {
    if (!opDimBulkFeedback) return;
    const t = window.setTimeout(() => setOpDimBulkFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [opDimBulkFeedback]);

  const opDimBulkAllVisibleSelected =
    filteredOperationUsers.length > 0 && filteredOperationUsers.every((u) => opDimBulkSel.has(u.id));
  const opDimBulkSomeVisibleSelected =
    filteredOperationUsers.some((u) => opDimBulkSel.has(u.id)) && !opDimBulkAllVisibleSelected;

  useEffect(() => {
    const el = opDimBulkHeaderCheckboxRef.current;
    if (el) el.indeterminate = opDimBulkSomeVisibleSelected;
  }, [opDimBulkSomeVisibleSelected]);

  const opDimGrantHeaderAllOn =
    filteredOperationUsers.length > 0 && filteredOperationUsers.every((u) => getOpEffective(u));
  const opDimGrantHeaderSomeOn =
    filteredOperationUsers.some((u) => getOpEffective(u)) && !opDimGrantHeaderAllOn;

  useEffect(() => {
    const el = opDimGrantHeaderSwitchRef.current;
    if (el) el.indeterminate = opDimGrantHeaderSomeOn;
  }, [opDimGrantHeaderSomeOn]);

  const toggleOpDimSelectAllVisible = (checked: boolean) => {
    if (checked) setOpDimBulkSel(new Set(filteredOperationUsers.map((u) => u.id)));
    else setOpDimBulkSel(new Set());
  };

  const postOpDimBulkPatch = async (items: Array<Record<string, unknown> & { user_id: number }>): Promise<boolean> => {
    if (items.length === 0) return false;
    setAccessBulkSavePending(true);
    try {
      await api.post(`/api/${tenantSlug}/access/users-bulk-patch`, { items });
      await invalidateAccessWorkspaceCaches();
      setOpDimBulkSel(new Set());
      setScopeDimBulkSel(new Set());
      return true;
    } catch {
      return false;
    } finally {
      setAccessBulkSavePending(false);
    }
  };

  const bulkApplyOpDimEffective = async (wantEffective: boolean) => {
    if (!selectedDimension || tab !== "operations") return;
    const key = selectedDimension.key;
    const hadRowSelection = opDimBulkSel.size > 0;
    const targets = hadRowSelection ? filteredOperationUsers.filter((u) => opDimBulkSel.has(u.id)) : filteredOperationUsers;
    const items: Array<Record<string, unknown> & { user_id: number }> = [];
    let skippedNoManage = 0;
    for (const u of targets) {
      if (wantEffective && key !== ACCESS_MANAGE_KEY && !u.has_access_manage) {
        skippedNoManage++;
        continue;
      }
      const body = getOpPatchBodyForToggle(u, wantEffective, key);
      if (body) items.push({ user_id: u.id, ...body });
    }
    if (items.length === 0) {
      if (skippedNoManage > 0) {
        setOpDimBulkFeedback({
          tone: "err",
          text: `Для ${skippedNoManage} пользов. пропущено: сначала включите «Доступ: управление» (access.manage).`
        });
      } else {
        setOpDimBulkFeedback({ tone: "ok", text: "Изменений не требуется" });
      }
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setOpDimBulkFeedback({
        tone: "ok",
        text:
          (wantEffective
            ? hadRowSelection
              ? `Доступ разрешён для выбранных (${items.length}), одним запросом`
              : `Доступ разрешён для всех видимых (${items.length}), одним запросом`
            : hadRowSelection
              ? `Доступ изменён для выбранных (${items.length}), одним запросом`
              : `Доступ изменён для всех видимых (${items.length}), одним запросом`) +
          (skippedNoManage > 0
            ? `; пропущено ${skippedNoManage} без «Доступ: управление» (access.manage).`
            : "")
      });
    } else {
      setOpDimBulkFeedback({ tone: "err", text: "Не удалось применить массово" });
    }
  };

  const bulkDetachOpDimSelected = async () => {
    if (!selectedDimension || tab !== "operations") return;
    const key = selectedDimension.key;
    const targets = filteredOperationUsers.filter((u) => opDimBulkSel.has(u.id) && (u.from_direct_allow || u.from_direct_deny));
    const items = targets.map((u) => ({ user_id: u.id, remove_permission_keys: [key] }));
    if (items.length === 0) {
      setOpDimBulkFeedback({
        tone: "ok",
        text: "Среди выбранных нет строк с пользовательской настройкой (только из роли — открепление недоступно)"
      });
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setOpDimBulkFeedback({ tone: "ok", text: `Откреплено пользовательских настроек: ${items.length}` });
    } else {
      setOpDimBulkFeedback({ tone: "err", text: "Не удалось открепить" });
    }
  };

  const isScopeDimensionTab = (t: typeof tab): t is ScopeDimensionTab =>
    t === "cash_desks" || t === "warehouses" || t === "branches" || t === "payment_methods";

  /** Modal: предупреждение только если реально есть что сохранять и в payload есть выдача операции без `access.manage`. */
  const modalGrantValidationError = useMemo((): string | null => {
    if (!opUsersModalOpen || !selectedDimension) return null;
    if (modalBulkItems.length === 0) return null;
    if (usersModalKind === "operations") {
      const key = selectedDimension.key;
      if (key === ACCESS_MANAGE_KEY) return null;
      const byId = new Map(opModalUsers.map((u) => [u.id, u]));
      for (const item of modalBulkItems) {
        const perms = item.permissions as string[] | undefined;
        if (!Array.isArray(perms) || !perms.includes(key)) continue;
        const u = byId.get(item.user_id);
        if (u && !u.has_access_manage) {
          return "Сначала включите «Доступ: управление» (access.manage) у пользователей, которым выдаёте операцию.";
        }
      }
      return null;
    }
    return null;
  }, [opUsersModalOpen, selectedDimension, usersModalKind, opModalUsers, modalBulkItems]);

  useEffect(() => {
    setScopeDimBulkSel((prev) => {
      if (prev.size === 0) return prev;
      const vis = new Set(filteredCashUsers.map((u) => u.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (vis.has(id)) next.add(id);
      }
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [filteredCashUsers]);

  useEffect(() => {
    if (!scopeDimBulkFeedback) return;
    const t = window.setTimeout(() => setScopeDimBulkFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [scopeDimBulkFeedback]);

  const scopeDimBulkAllVisibleSelected =
    filteredCashUsers.length > 0 && filteredCashUsers.every((u) => scopeDimBulkSel.has(u.id));
  const scopeDimBulkSomeVisibleSelected =
    filteredCashUsers.some((u) => scopeDimBulkSel.has(u.id)) && !scopeDimBulkAllVisibleSelected;

  useEffect(() => {
    const el = scopeDimBulkHeaderCheckboxRef.current;
    if (el) el.indeterminate = scopeDimBulkSomeVisibleSelected;
  }, [scopeDimBulkSomeVisibleSelected]);

  const toggleScopeDimSelectAllVisible = (checked: boolean) => {
    if (checked) setScopeDimBulkSel(new Set(filteredCashUsers.map((u) => u.id)));
    else setScopeDimBulkSel(new Set());
  };

  /** Снять привязку к кассе / складу / филиалу / способу оплаты (как «запрет» в операциях). */
  const bulkDetachScopeDimLinks = async () => {
    if (!selectedDimension || !isScopeDimensionTab(tab)) return;
    const kind = tab;
    const hadRowSelection = scopeDimBulkSel.size > 0;
    const targets = hadRowSelection ? filteredCashUsers.filter((u) => scopeDimBulkSel.has(u.id)) : filteredCashUsers;
    const items: Array<Record<string, unknown> & { user_id: number }> = [];
    for (const u of targets) {
      const full = opModalUsersById.get(u.id);
      if (!full) continue;
      const body = buildScopeDimensionPatchBody(kind, selectedDimension.key, full, false);
      if (!body) continue;
      items.push({ user_id: u.id, ...body });
    }
    if (items.length === 0) {
      setScopeDimBulkFeedback({
        tone: "ok",
        text: opModalUsers.length === 0 ? "Загрузка списка пользователей…" : "Изменений не требуется"
      });
      return;
    }
    const ok = await postOpDimBulkPatch(items);
    if (ok) {
      setScopeDimBulkFeedback({
        tone: "ok",
        text: hadRowSelection
          ? `Откреплено выбранных: ${items.length}, одним запросом`
          : `Откреплено всех видимых: ${items.length}, одним запросом`
      });
    } else {
      setScopeDimBulkFeedback({ tone: "err", text: "Не удалось применить массово" });
    }
  };

  const opModalRoleGroups = useMemo(() => {
    const q = opUsersModalSearch.trim().toLowerCase();
    const groups = new Map<string, AccessUserRow[]>();
    for (const u of opModalUsers) {
      const role = String(u.role || "").trim() || "Без роли";
      const matchesSearch =
        !q || `${u.full_name || ""} ${u.login} ${u.code || ""} ${u.role || ""} ${u.branch || ""}`.toLowerCase().includes(q);
      if (!matchesSearch) continue;
      if (opUsersModalShowSelected && !opUsersModalSelected.has(u.id)) continue;
      const arr = groups.get(role) ?? [];
      arr.push(u);
      groups.set(role, arr);
    }
    const sortedRoleKeys = sortAccessModalRoleKeys([...groups.keys()]);
    return sortedRoleKeys.map((role) => {
      const users = groups.get(role) ?? [];
      return {
        role,
        users: [...users].sort((a: AccessUserRow, b: AccessUserRow) =>
          (a.full_name || a.login).localeCompare(b.full_name || b.login, "ru")
        )
      };
    });
  }, [opModalUsers, opUsersModalSearch, opUsersModalShowSelected, opUsersModalSelected]);

  useEffect(() => {
    if (!selectedKey) return;
    if (!filteredSideRows.some((r) => r.key === selectedKey)) setSelectedKey(null);
  }, [filteredSideRows, selectedKey]);

  useEffect(() => {
    if (!(tab === "users" || tab === "operations")) return;
    setLeftExpandedGroups(new Set());
  }, [tab, leftPanelGroupListSignature]);

  useEffect(() => {
    if (tab !== "operations") {
      setLeftExpandedSubgroups(new Set());
      return;
    }
    setLeftExpandedSubgroups(new Set());
  }, [tab, operationLeftSubgroupStructureSignature]);

  useEffect(() => {
    if (tab === "users") return;
    if (selectedKey) return;
    if (filteredSideRows.length === 0) return;
    startListNavTransition(() => setSelectedKey(filteredSideRows[0]!.key));
  }, [tab, selectedKey, filteredSideRows, startListNavTransition]);

  const activeTabLabel =
    {
      users: "Пользователи",
      operations: "Операции",
      cash_desks: "Кассы",
      warehouses: "Склады",
      branches: "Филиалы",
      payment_methods: "Способы оплаты"
    }[tab] ?? "Пользователи";

  const allVisibleModalUserIds = useMemo(
    () => opModalRoleGroups.flatMap((g: { role: string; users: AccessUserRow[] }) => g.users.map((u: AccessUserRow) => u.id)),
    [opModalRoleGroups]
  );
  const modalRoleKeys = useMemo(() => opModalRoleGroups.map((g) => g.role), [opModalRoleGroups]);
  const allModalGroupsExpanded =
    modalRoleKeys.length > 0 && modalRoleKeys.every((r) => opUsersModalExpandedRoles.has(r));
  const allVisibleModalSelected =
    allVisibleModalUserIds.length > 0 && allVisibleModalUserIds.every((id) => opUsersModalSelected.has(id));
  const allVisibleModalSomeSelected =
    allVisibleModalUserIds.some((id) => opUsersModalSelected.has(id)) && !allVisibleModalSelected;

  const toggleModalRoleExpanded = (role: string) => {
    setOpUsersModalExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const toggleModalSelectAllVisible = (checked: boolean) => {
    setOpUsersModalSelected((prev) => {
      const n = new Set(prev);
      for (const id of allVisibleModalUserIds) {
        if (checked) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  };

  const toggleModalSelectRole = (role: string, checked: boolean) => {
    const group = opModalRoleGroups.find((g) => g.role === role);
    if (!group) return;
    setOpUsersModalSelected((prev) => {
      const n = new Set(prev);
      for (const u of group.users) {
        if (checked) n.add(u.id);
        else n.delete(u.id);
      }
      return n;
    });
  };

  const saveOperationUsersModal = async () => {
    if (!selectedDimension) return;
    if (modalGrantValidationError) return;
    const items = modalBulkItems;
    if (items.length > 0) {
      setAccessBulkSavePending(true);
      try {
        await api.post(`/api/${tenantSlug}/access/users-bulk-patch`, { items });
      } finally {
        setAccessBulkSavePending(false);
      }
    }
    setOpUsersModalOpen(false);
    await invalidateAccessWorkspaceCaches();
  };

  const detachScopeUser = async (u: DimensionUserRow) => {
    if (!selectedDimension) return;
    const full = opModalUsersById.get(u.id);
    if (!full) return;
    const kind = tab as ScopeDimensionTab;
    if (kind !== "cash_desks" && kind !== "warehouses" && kind !== "branches" && kind !== "payment_methods") return;
    const body = buildScopeDimensionPatchBody(kind, selectedDimension.key, full, false);
    if (!body) return;
    await operationAccessMut.mutateAsync({ userId: u.id, body });
  };

  const opDimVirtualItems =
    tab === "operations" && displayOperationUsers.length > 0 ? opDimRowVirtualizer.getVirtualItems() : [];
  const opDimPadTop = opDimVirtualItems.length > 0 ? opDimVirtualItems[0].start : 0;
  const opDimPadBot =
    opDimVirtualItems.length > 0
      ? opDimRowVirtualizer.getTotalSize() - opDimVirtualItems[opDimVirtualItems.length - 1].end
      : 0;

  const scopeDimVirtualItems =
    (tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods") &&
    displayCashUsers.length > 0
      ? scopeDimRowVirtualizer.getVirtualItems()
      : [];
  const scopeDimPadTop = scopeDimVirtualItems.length > 0 ? scopeDimVirtualItems[0].start : 0;
  const scopeDimPadBot =
    scopeDimVirtualItems.length > 0
      ? scopeDimRowVirtualizer.getTotalSize() - scopeDimVirtualItems[scopeDimVirtualItems.length - 1].end
      : 0;

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
              data-active={tab === x.key}
              className={`access-tab-chip ${tab === x.key ? "" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => {
                setTab(x.key as typeof tab);
                startListNavTransition(() => setSelectedKey(null));
              }}
              type="button"
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/access/role-defaults"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs no-underline")}
          >
            Состав ролей по умолчанию
          </Link>
          <Link
            href="/access/history"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs no-underline")}
          >
            История изменения доступов
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch">
        <div className="access-left-panel flex min-h-0 w-full flex-col gap-2 overflow-hidden p-2.5 lg:min-h-0 lg:w-[min(300px,100%)] lg:min-w-[260px] lg:max-w-[300px] lg:shrink-0">
          <div className="shrink-0 rounded-md border border-border/60 bg-card p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold text-foreground">Фильтр</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="access-filter-field-label">Статус</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    data-active={status === "active"}
                    className={`access-status-pill flex-1 ${status === "active" ? "" : "text-muted-foreground hover:bg-muted/40"}`}
                    onClick={() => setStatus("active")}
                  >
                    Активные
                  </button>
                  <button
                    type="button"
                    data-active={status === "inactive"}
                    className={`access-status-pill flex-1 ${status === "inactive" ? "" : "text-muted-foreground hover:bg-muted/40"}`}
                    onClick={() => setStatus("inactive")}
                  >
                    Неактивные
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="access-filter-field-label">Поиск</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Название, логин, код…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-card shadow-sm">
            <div className="access-list-cap flex flex-wrap items-center justify-between gap-2">
              <span>{activeTabLabel}</span>
              <div className="flex items-center gap-2">
                {(tab === "users" || tab === "operations") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      if (leftExpandedGroups.size > 0) setLeftExpandedGroups(new Set());
                      else setLeftExpandedGroups(new Set(groupedFilteredSideRows.map((g) => g.group)));
                    }}
                  >
                    {leftExpandedGroups.size > 0 ? "Свернуть" : "Развернуть"}
                  </Button>
                ) : null}
                <span className="font-normal tabular-nums text-muted-foreground">{filteredSideRows.length}</span>
              </div>
            </div>
            <div className="scrollbar-none min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden overscroll-contain p-1.5 pr-0.5">
              {(tab === "users" && usersQ.isLoading) || (tab !== "users" && dimensionsQ.isLoading) ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">Загрузка…</p>
              ) : filteredSideRows.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">Ничего не найдено</p>
              ) : tab === "users" ? (
                groupedFilteredSideRows.map((g: { group: string; items: SideRow[] }) => {
                  const expanded = leftExpandedGroups.has(g.group);
                  return (
                    <div key={g.group} className="rounded-md border border-border/50">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs"
                        onClick={() =>
                          setLeftExpandedGroups((prev) => {
                            if (prev.has(g.group)) return new Set();
                            return new Set([g.group]);
                          })
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-muted-foreground">{expanded ? "▾" : "▸"}</span>
                          <span className="font-medium">{g.group}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{g.items.length}</span>
                      </button>
                      <div
                        className={`border-t border-border/50 transition-all duration-200 ease-out ${
                          expanded ? "p-1.5 opacity-100" : "hidden p-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-2">
                          <div>
                            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Активные</div>
                            <div className="space-y-1">
                              {g.items.filter((r) => r.is_active).map((r: SideRow) => (
                                <button
                                  key={r.key}
                                  type="button"
                                  onClick={() => selectSideRowKey(r.key)}
                                  onPointerEnter={() => prefetchDimensionUsersForKey(r.key)}
                                  data-active={selectedKey === r.key}
                                  className={cn(
                                    "access-item-card w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                                    selectedKey === r.key
                                      ? ""
                                      : isNestedOperationRow(r)
                                        ? "ml-2 border-l-2 border-l-sky-400/70 bg-sky-50/40 dark:bg-sky-900/10"
                                        : ""
                                  )}
                                >
                                  {r.idLine ? <div className="text-[11px] font-medium tabular-nums text-muted-foreground">{r.idLine}</div> : null}
                                  <div className="text-sm font-medium leading-snug">{r.title}</div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                                  {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Неактивные</div>
                            <div className="space-y-1">
                              {g.items.filter((r) => !r.is_active).map((r: SideRow) => {
                                const fullUser = rows.find((u) => String(u.id) === r.key);
                                const isSel = selectedKey === r.key;
                                const toggleThisPending =
                                  toggleMut.isPending && toggleMut.variables?.id === Number(r.key);
                                return (
                                  <div
                                    key={r.key}
                                    data-active={isSel}
                                    className={cn(
                                      "w-full overflow-hidden rounded-md border px-2.5 py-2 shadow-sm transition-colors",
                                      isSel
                                        ? "border-rose-600 bg-rose-50 dark:border-rose-500 dark:bg-rose-950/50"
                                        : "border-rose-300/80 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/30"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => selectSideRowKey(r.key)}
                                      className="w-full rounded-sm text-left outline-none ring-offset-background hover:opacity-95 focus-visible:ring-2 focus-visible:ring-rose-500/60"
                                    >
                                      {r.idLine ? (
                                        <div className="text-[11px] font-medium tabular-nums text-rose-900/80 dark:text-rose-200/90">
                                          {r.idLine}
                                        </div>
                                      ) : null}
                                      <div className="text-sm font-medium leading-snug text-rose-950 dark:text-rose-50">{r.title}</div>
                                      <div className="mt-0.5 text-[11px] text-rose-800/85 dark:text-rose-200/80">{r.subtitle}</div>
                                    </button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={!fullUser || toggleThisPending}
                                      className="mt-2 h-8 w-full border-0 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (fullUser) void toggleMut.mutateAsync(fullUser);
                                      }}
                                    >
                                      Включить
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : tab === "operations" ? (
                operationNestedGroups.map((g) => {
                  const groupExpanded = leftExpandedGroups.has(g.group);
                  return (
                    <div key={g.group} className="rounded-md border border-slate-300/80 bg-slate-50/40 dark:border-slate-700/80 dark:bg-slate-900/20">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200"
                        onClick={() =>
                          setLeftExpandedGroups((prev) => {
                            if (prev.has(g.group)) return new Set();
                            return new Set([g.group]);
                          })
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-muted-foreground">{groupExpanded ? "▾" : "▸"}</span>
                          <span className="font-medium">{g.group}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {g.subgroups.reduce((acc, sg) => acc + sg.items.length, 0)}
                        </span>
                      </button>
                      <div className={groupExpanded ? "border-t border-slate-300/70 p-1.5 dark:border-slate-700/70" : "hidden"}>
                        <div className="space-y-1.5">
                          {g.subgroups.map((sg) => {
                            const subgroupKey = `${g.group}|||${sg.subgroup}`;
                            const subgroupExpanded = groupExpanded && leftExpandedSubgroups.has(subgroupKey);
                            return (
                              <div
                                key={subgroupKey}
                                className="rounded-md border border-indigo-300/70 bg-indigo-50/40 dark:border-indigo-800/70 dark:bg-indigo-950/20"
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-medium text-indigo-700 dark:text-indigo-200"
                                  onClick={() =>
                                    setLeftExpandedSubgroups((prev) => {
                                      if (prev.has(subgroupKey)) return new Set();
                                      return new Set([subgroupKey]);
                                    })
                                  }
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="text-muted-foreground">{subgroupExpanded ? "▾" : "▸"}</span>
                                    <span className="font-medium">{sg.subgroup}</span>
                                  </span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{sg.items.length}</span>
                                </button>
                                <div className={subgroupExpanded ? "border-t border-indigo-300/60 p-1.5 dark:border-indigo-800/60" : "hidden"}>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Активные</div>
                                      <div className="space-y-1">
                                        {sg.items.filter((r) => r.is_active).map((r) => (
                                          <button
                                            key={r.key}
                                            type="button"
                                            onClick={() => selectSideRowKey(r.key)}
                                            onPointerEnter={() => prefetchDimensionUsersForKey(r.key)}
                                            data-active={selectedKey === r.key}
                                            className={cn(
                                              "access-item-card w-full px-3 py-2.5 text-left transition-colors",
                                              selectedKey === r.key
                                                ? "hover:bg-muted/40"
                                                : "border border-emerald-300/70 bg-emerald-50/50 hover:bg-emerald-100/60 dark:border-emerald-800/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30",
                                              isNestedOperationRow(r)
                                                ? selectedKey === r.key
                                                  ? "ml-2 border-l-2 border-l-primary/65"
                                                  : "ml-2 border-l-2 border-l-emerald-500/80"
                                                : ""
                                            )}
                                          >
                                            <div className="text-sm font-medium leading-snug">{r.title}</div>
                                            <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                                            {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Неактивные</div>
                                      <div className="space-y-1">
                                        {sg.items.filter((r) => !r.is_active).map((r) => (
                                          <button
                                            key={r.key}
                                            type="button"
                                            onClick={() => selectSideRowKey(r.key)}
                                            onPointerEnter={() => prefetchDimensionUsersForKey(r.key)}
                                            data-active={selectedKey === r.key}
                                            className={cn(
                                              "access-item-card w-full px-3 py-2.5 text-left transition-colors",
                                              selectedKey === r.key
                                                ? "hover:bg-muted/40"
                                                : "border border-rose-300/70 bg-rose-50/50 hover:bg-rose-100/60 dark:border-rose-800/70 dark:bg-rose-950/20 dark:hover:bg-rose-900/30",
                                              isNestedOperationRow(r)
                                                ? selectedKey === r.key
                                                  ? "ml-2 border-l-2 border-l-primary/65"
                                                  : "ml-2 border-l-2 border-l-rose-500/80"
                                                : ""
                                            )}
                                          >
                                            <div className="text-sm font-medium leading-snug">{r.title}</div>
                                            <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                                            {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                filteredSideRows.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => selectSideRowKey(r.key)}
                    onPointerEnter={() => prefetchDimensionUsersForKey(r.key)}
                    data-active={selectedKey === r.key}
                    className="access-item-card w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    {r.idLine ? <div className="text-[11px] font-medium tabular-nums text-muted-foreground">{r.idLine}</div> : null}
                    <div className="text-sm font-medium leading-snug">{r.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                    {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="access-right-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {tab === "users" && selected ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <AccessUserDetailPanel
                tenantSlug={tenantSlug}
                userId={selected.id}
                onInvalidateUsers={scheduleAccessUsersListRefresh}
                userAccountControls={{
                  isActive: selected.status === "active",
                  onToggle: () => void toggleMut.mutateAsync(selected),
                  onReset: (id) => {
                    if (id !== selected.id) return;
                    void resetMut.mutateAsync(id);
                  },
                  togglePending: toggleMut.isPending && toggleMut.variables?.id === selected.id,
                  resetPending: resetMut.isPending && resetMut.variables === selected.id
                }}
              />
            </div>
          ) : tab !== "users" && selectedDimension ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden overscroll-contain p-3 sm:p-4">
              {dimensionUsersApiMissing ? (
                <div className="shrink-0 rounded-md border border-border/60 bg-card p-3 shadow-sm sm:p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    API `dimensions/users` пока недоступен в текущем backend runtime. Перезапустите backend dev-процесс.
                  </p>
                </div>
              ) : null}
              {tab === "operations" ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                  <div className="shrink-0 rounded-md border border-border/60 bg-card p-2 shadow-sm">
                    <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                        <SearchableMultiSelectPanel<string>
                          label="Роль"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Роль: все"
                          triggerClassName="access-filter-select w-full"
                          items={operationRoleFilterItems}
                          selected={opFilterRolesDraft}
                          onSelectedChange={setOpFilterRolesDraft}
                          searchable={operationRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          filterItemsBySearch={operationRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          searchPlaceholder="Поиск роли"
                          search={opRoleFilterSearch}
                          onSearchChange={setOpRoleFilterSearch}
                          onOpenChange={(o) => {
                            if (!o) setOpRoleFilterSearch("");
                          }}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Роль: все", sel, it)}
                          minPopoverWidth={260}
                          maxListHeightClass="max-h-56"
                          emptyMessage="Нет ролей в списке"
                        />
                        <SearchableMultiSelectPanel<string>
                          label="Должность"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Должность: все"
                          triggerClassName="access-filter-select w-full"
                          items={operationPositionFilterItems}
                          selected={opFilterPositionsDraft}
                          onSelectedChange={setOpFilterPositionsDraft}
                          searchable={operationPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          filterItemsBySearch={operationPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          searchPlaceholder="Поиск должности"
                          search={opPosFilterSearch}
                          onSearchChange={setOpPosFilterSearch}
                          onOpenChange={(o) => {
                            if (!o) setOpPosFilterSearch("");
                          }}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Должность: все", sel, it)}
                          minPopoverWidth={260}
                          maxListHeightClass="max-h-56"
                          emptyMessage="Нет должностей в списке"
                        />
                        <SearchableMultiSelectPanel<string>
                          label="Предоставление доступа"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Предоставление: все"
                          triggerClassName="access-filter-select w-full"
                          items={OP_GRANT_FILTER_ITEMS}
                          selected={opFilterGrantsDraft}
                          onSelectedChange={setOpFilterGrantsDraft}
                          searchable={false}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) =>
                            formatAccessFilterTriggerSummary("Предоставление: все", sel, it)
                          }
                          minPopoverWidth={240}
                          maxListHeightClass="max-h-40"
                        />
                        <SearchableMultiSelectPanel<string>
                          label="Активность"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Активность: все"
                          triggerClassName="access-filter-select w-full"
                          items={OP_ACTIVITY_FILTER_ITEMS}
                          selected={opFilterActivitiesDraft}
                          onSelectedChange={setOpFilterActivitiesDraft}
                          searchable={false}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) =>
                            formatAccessFilterTriggerSummary("Активность: все", sel, it)
                          }
                          minPopoverWidth={220}
                          maxListHeightClass="max-h-40"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setOpFilterRoles(new Set(opFilterRolesDraft));
                            setOpFilterPositions(new Set(opFilterPositionsDraft));
                            setOpFilterGrants(new Set(opFilterGrantsDraft));
                            setOpFilterActivities(new Set(opFilterActivitiesDraft));
                          }}
                        >
                          Применить
                        </Button>
                      </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
                    <div className="relative min-w-0 max-w-sm flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Поиск"
                        value={opSearch}
                        onChange={(e) => setOpSearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                    <div className="flex shrink-0 justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs" type="button" disabled>
                        Настройки
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        type="button"
                        title="Кого включить или исключить из доступа к выбранной операции"
                        onClick={() => {
                          setUsersModalKind("operations");
                          setOpUsersModalOpen(true);
                        }}
                      >
                        Пользователи
                      </Button>
                    </div>
                  </div>
                  {opDimBulkFeedback ? (
                    <p
                      role="status"
                      className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                        opDimBulkFeedback.tone === "ok"
                          ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {opDimBulkFeedback.text}
                    </p>
                  ) : null}
                  {dimensionUsersQ.isLoading ? (
                    <p className="shrink-0 text-xs text-muted-foreground">Загрузка…</p>
                  ) : filteredOperationUsers.length === 0 ? (
                    <p className="shrink-0 text-xs text-muted-foreground">Никакой информации не найдено</p>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
                      <div className="access-split-scroll-panel min-h-0 flex-1">
                      <div ref={dimTableHeadScrollRef} className="access-split-scroll-head" onScroll={onDimTableHeadScroll}>
                        <table className="access-split-scroll-table">
                          <AccessDimUsersColGroup />
                          <thead className="app-table-thead">
                            <tr>
                              <th scope="col" className="access-matrix-col-select py-1">
                                <span className="sr-only">Выбор строк</span>
                                <input
                                  ref={opDimBulkHeaderCheckboxRef}
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-teal-700"
                                  checked={opDimBulkAllVisibleSelected}
                                  disabled={
                                    filteredOperationUsers.length === 0 ||
                                    accessBulkSavePending ||
                                    operationAccessMut.isPending
                                  }
                                  onChange={(e) => toggleOpDimSelectAllVisible(e.target.checked)}
                                  title="Выбрать все видимые строки"
                                  aria-label="Выбрать все видимые строки"
                                />
                              </th>
                              <th className="min-w-0 px-1.5 py-0.5 text-left align-middle text-[10px] font-semibold leading-tight">
                                <TableSortButton
                                  label="Имя пользователя"
                                  active={opDimUserSort?.key === "name"}
                                  dir={opDimUserSort?.key === "name" ? opDimUserSort.dir : "asc"}
                                  onClick={() => toggleOpDimUserSort("name")}
                                />
                              </th>
                              <th className="w-20 px-1.5 py-0.5 text-left align-middle text-[10px] font-semibold leading-tight">
                                <TableSortButton
                                  label="Роль"
                                  active={opDimUserSort?.key === "role"}
                                  dir={opDimUserSort?.key === "role" ? opDimUserSort.dir : "asc"}
                                  onClick={() => toggleOpDimUserSort("role")}
                                />
                              </th>
                              <th className="w-[5.5rem] px-1.5 py-0.5 text-left align-middle text-[10px] font-semibold leading-tight">
                                <TableSortButton
                                  label="Должность"
                                  active={opDimUserSort?.key === "position"}
                                  dir={opDimUserSort?.key === "position" ? opDimUserSort.dir : "asc"}
                                  onClick={() => toggleOpDimUserSort("position")}
                                />
                              </th>
                              <th className="w-16 px-1 py-0.5 text-center align-middle text-[10px] font-semibold leading-tight">
                                <TableSortButton
                                  label="Статус"
                                  active={opDimUserSort?.key === "status"}
                                  dir={opDimUserSort?.key === "status" ? opDimUserSort.dir : "asc"}
                                  onClick={() => toggleOpDimUserSort("status")}
                                  align="center"
                                  className="w-full"
                                />
                              </th>
                              <th
                                scope="col"
                                className="w-[5.25rem] px-1 py-0.5 text-center align-middle text-[10px] font-semibold leading-tight"
                              >
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span
                                    className="max-w-full text-center text-[8px] font-semibold leading-none"
                                    title="Выдача выбранной операции другим пользователям (в разделе «Доступ»). Доступно только при включённой операции «Доступ: управление» у пользователя."
                                  >
                                    Предоставление доступа
                                  </span>
                                  {filteredOperationUsers.length > 0 ? (
                                    <label className="relative flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                                      <input
                                        ref={opDimGrantHeaderSwitchRef}
                                        type="checkbox"
                                        role="switch"
                                        aria-checked={opDimGrantHeaderAllOn}
                                        className="peer sr-only"
                                        checked={opDimGrantHeaderAllOn}
                                        disabled={accessBulkSavePending || operationAccessMut.isPending}
                                        title={
                                          selectedDimension?.key !== ACCESS_MANAGE_KEY &&
                                          filteredOperationUsers.some((u) => !u.has_access_manage && !getOpEffective(u))
                                            ? "Сначала включите «Доступ: управление» у пользователей без этой операции (или выберите только access.manage). Массово включатся только строки, где это возможно."
                                            : opDimBulkSel.size > 0
                                              ? "Предоставление доступа: разрешить или запретить операцию для выбранных"
                                              : "Предоставление доступа: разрешить или запретить операцию для всех видимых"
                                        }
                                        onChange={(e) => void bulkApplyOpDimEffective(e.target.checked)}
                                      />
                                      <span
                                        className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
                                        aria-hidden
                                      />
                                      <span
                                        className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                                        aria-hidden
                                      />
                                    </label>
                                  ) : null}
                                </div>
                              </th>
                              <th className="w-20 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight">Действия</th>
                            </tr>
                          </thead>
                        </table>
                      </div>
                      <div ref={dimTableBodyScrollRef} className="access-split-scroll-body" onScroll={onDimTableBodyScroll}>
                        <table className="access-split-scroll-table">
                          <AccessDimUsersColGroup />
                          <tbody>
                            {opDimPadTop > 0 ? (
                              <tr aria-hidden>
                                <td
                                  colSpan={7}
                                  style={{ height: opDimPadTop, padding: 0, border: "none", lineHeight: 0 }}
                                />
                              </tr>
                            ) : null}
                            {opDimVirtualItems.map((vi) => {
                              const u = displayOperationUsers[vi.index];
                              if (!u) return null;
                              const effective = getOpEffective(u);
                              const rowOpAccessBusy = opDimAccessBusyUserId === u.id;
                              return (
                                <tr key={vi.key} className="border-t border-border/50" data-index={vi.index}>
                                  <td className="access-matrix-col-select py-1.5 text-center align-middle">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 accent-teal-700"
                                      checked={opDimBulkSel.has(u.id)}
                                      disabled={accessBulkSavePending}
                                      onChange={(e) => {
                                        setOpDimBulkSel((prev) => {
                                          const n = new Set(prev);
                                          if (e.target.checked) n.add(u.id);
                                          else n.delete(u.id);
                                          return n;
                                        });
                                      }}
                                      aria-label={`Выбрать: ${u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}`}
                                    />
                                  </td>
                                  <td className="min-w-0 px-1.5 py-1.5 align-middle leading-snug">{u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}</td>
                                  <td className="px-1.5 py-1.5 align-middle text-[11px]">{u.role}</td>
                                  <td className="truncate px-1.5 py-1.5 align-middle text-[11px] text-muted-foreground" title={u.position || undefined}>
                                    {u.position || "—"}
                                  </td>
                                  <td className="px-1 py-1.5 text-center align-middle">
                                    <span
                                      className={
                                        u.is_active
                                          ? "inline-block rounded-md bg-emerald-600/15 px-1 py-0.5 text-[9px] font-medium text-emerald-800 dark:text-emerald-200"
                                          : "inline-block rounded-md bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
                                      }
                                    >
                                      {u.is_active ? "Активный" : "Неактивный"}
                                    </span>
                                  </td>
                                  <td className="w-[5.25rem] px-1 py-1.5 text-center align-middle">
                                    <label className="relative mx-auto flex h-6 w-11 cursor-pointer items-center justify-center rounded-full">
                                      <input
                                        type="checkbox"
                                        role="switch"
                                        className="peer sr-only"
                                        checked={effective}
                                        disabled={
                                          accessBulkSavePending ||
                                          rowOpAccessBusy ||
                                          (Boolean(selectedDimension) &&
                                            selectedDimension!.key !== ACCESS_MANAGE_KEY &&
                                            !u.has_access_manage &&
                                            !effective)
                                        }
                                        title={
                                          selectedDimension?.key !== ACCESS_MANAGE_KEY &&
                                          !u.has_access_manage &&
                                          !effective
                                            ? "Включите «Доступ: управление» (access.manage), чтобы выдавать эту операцию."
                                            : "Выдача операции пользователю (и далее — другим через «Доступ» при наличии access.manage)"
                                        }
                                        onChange={(e) => {
                                          const body = getOpPatchBodyForToggle(u, e.target.checked, selectedDimension!.key);
                                          if (!body) return;
                                          void operationAccessMut.mutateAsync({ userId: u.id, body });
                                        }}
                                      />
                                      <span
                                        className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50"
                                        aria-hidden
                                      />
                                      <span
                                        className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                                        aria-hidden
                                      />
                                    </label>
                                  </td>
                                  <td className="w-20 px-1 py-1.5 text-center align-middle">
                                    {u.from_direct_allow || u.from_direct_deny ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 min-w-0 border-teal-600/45 px-1.5 text-[10px] text-teal-950 hover:bg-teal-500/10 dark:text-emerald-100"
                                        disabled={accessBulkSavePending || rowOpAccessBusy}
                                        onClick={() =>
                                          void operationAccessMut.mutateAsync({
                                            userId: u.id,
                                            body: { remove_permission_keys: [selectedDimension!.key] }
                                          })
                                        }
                                      >
                                        Открепить
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {opDimPadBot > 0 ? (
                              <tr aria-hidden>
                                <td
                                  colSpan={7}
                                  style={{ height: opDimPadBot, padding: 0, border: "none", lineHeight: 0 }}
                                />
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                      {opDimBulkSel.size > 0 ? (
                        <AccessBulkBottomBar
                          variant="operations"
                          selectedCount={opDimBulkSel.size}
                          totalVisibleCount={filteredOperationUsers.length}
                          onClear={() => setOpDimBulkSel(new Set())}
                          busy={accessBulkSavePending || operationAccessMut.isPending}
                          denyTitle="Запретить операцию для выбранных пользователей"
                          onDeny={() => void bulkApplyOpDimEffective(false)}
                          onDetach={() => void bulkDetachOpDimSelected()}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
                ) : tab === "cash_desks" || tab === "warehouses" || tab === "branches" || tab === "payment_methods" ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="shrink-0 rounded-md border border-border/60 bg-card p-2 shadow-sm">
                      <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                        <SearchableMultiSelectPanel<string>
                          label="Роль"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Роль: все"
                          triggerClassName="access-filter-select w-full"
                          items={cashRoleFilterItems}
                          selected={cashFilterRolesDraft}
                          onSelectedChange={setCashFilterRolesDraft}
                          searchable={cashRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          filterItemsBySearch={cashRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          searchPlaceholder="Поиск роли"
                          search={cashRoleFilterSearch}
                          onSearchChange={setCashRoleFilterSearch}
                          onOpenChange={(o) => {
                            if (!o) setCashRoleFilterSearch("");
                          }}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Роль: все", sel, it)}
                          minPopoverWidth={260}
                          maxListHeightClass="max-h-56"
                          emptyMessage="Нет ролей в списке"
                        />
                        <SearchableMultiSelectPanel<string>
                          label="Должность"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Должность: все"
                          triggerClassName="access-filter-select w-full"
                          items={cashPositionFilterItems}
                          selected={cashFilterPositionsDraft}
                          onSelectedChange={setCashFilterPositionsDraft}
                          searchable={cashPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          filterItemsBySearch={cashPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          searchPlaceholder="Поиск должности"
                          search={cashPosFilterSearch}
                          onSearchChange={setCashPosFilterSearch}
                          onOpenChange={(o) => {
                            if (!o) setCashPosFilterSearch("");
                          }}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Должность: все", sel, it)}
                          minPopoverWidth={260}
                          maxListHeightClass="max-h-56"
                          emptyMessage="Нет должностей в списке"
                        />
                        <div
                          className="access-filter-select flex w-full cursor-not-allowed items-center text-left text-muted-foreground opacity-70"
                          title="В этом списке только пользователи с прикреплением к выбранному объекту"
                          role="note"
                        >
                          Предоставление: прикреплённые
                        </div>
                        <SearchableMultiSelectPanel<string>
                          label="Активность"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Активность: все"
                          triggerClassName="access-filter-select w-full"
                          items={OP_ACTIVITY_FILTER_ITEMS}
                          selected={cashFilterActivitiesDraft}
                          onSelectedChange={setCashFilterActivitiesDraft}
                          searchable={false}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) =>
                            formatAccessFilterTriggerSummary("Активность: все", sel, it)
                          }
                          minPopoverWidth={220}
                          maxListHeightClass="max-h-40"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setCashFilterRoles(new Set(cashFilterRolesDraft));
                            setCashFilterPositions(new Set(cashFilterPositionsDraft));
                            setCashFilterActivities(new Set(cashFilterActivitiesDraft));
                          }}
                        >
                          Применить
                        </Button>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
                      <div className="relative min-w-0 max-w-sm flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Поиск"
                          value={cashSearch}
                          onChange={(e) => setCashSearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <div className="flex shrink-0 justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-8 text-xs" type="button" disabled>
                          Настройки
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          type="button"
                          title="Кого прикрепить или открепить от выбранной кассы, склада, филиала или способа оплаты"
                          onClick={() => {
                            setUsersModalKind(tab);
                            setOpUsersModalOpen(true);
                          }}
                        >
                          Пользователи
                        </Button>
                      </div>
                    </div>
                    {scopeDimBulkFeedback ? (
                      <p
                        role="status"
                        className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                          scopeDimBulkFeedback.tone === "ok"
                            ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {scopeDimBulkFeedback.text}
                      </p>
                    ) : null}
                    {dimensionUsersQ.isLoading ? (
                      <p className="shrink-0 text-xs text-muted-foreground">Загрузка…</p>
                    ) : filteredCashUsers.length === 0 ? (
                      <p className="shrink-0 text-xs text-muted-foreground">Никакой информации не найдено</p>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
                      <div className="access-split-scroll-panel min-h-0 flex-1">
                        <div ref={dimTableHeadScrollRef} className="access-split-scroll-head" onScroll={onDimTableHeadScroll}>
                          <table className="access-split-scroll-table">
                            <AccessDimUsersColGroup />
                            <thead className="app-table-thead">
                              <tr>
                                <th scope="col" className="access-matrix-col-select py-1">
                                  <span className="sr-only">Выбор строк</span>
                                  <input
                                    ref={scopeDimBulkHeaderCheckboxRef}
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-teal-700"
                                    checked={scopeDimBulkAllVisibleSelected}
                                    disabled={
                                      filteredCashUsers.length === 0 ||
                                      accessBulkSavePending ||
                                      operationAccessMut.isPending ||
                                      allUsersForOperationModalQ.isLoading
                                    }
                                    onChange={(e) => toggleScopeDimSelectAllVisible(e.target.checked)}
                                    title="Выбрать все видимые строки"
                                    aria-label="Выбрать все видимые строки"
                                  />
                                </th>
                                <th className="min-w-0 px-2 py-1 text-left align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Имя пользователя"
                                    active={scopeDimUserSort?.key === "name"}
                                    dir={scopeDimUserSort?.key === "name" ? scopeDimUserSort.dir : "asc"}
                                    onClick={() => toggleScopeDimUserSort("name")}
                                  />
                                </th>
                                <th className="w-28 px-2 py-1 text-left align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Роль"
                                    active={scopeDimUserSort?.key === "role"}
                                    dir={scopeDimUserSort?.key === "role" ? scopeDimUserSort.dir : "asc"}
                                    onClick={() => toggleScopeDimUserSort("role")}
                                  />
                                </th>
                                <th className="w-32 px-2 py-1 text-left align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Должность"
                                    active={scopeDimUserSort?.key === "position"}
                                    dir={scopeDimUserSort?.key === "position" ? scopeDimUserSort.dir : "asc"}
                                    onClick={() => toggleScopeDimUserSort("position")}
                                  />
                                </th>
                                <th className="w-24 px-2 py-1 text-center align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Статус"
                                    active={scopeDimUserSort?.key === "status"}
                                    dir={scopeDimUserSort?.key === "status" ? scopeDimUserSort.dir : "asc"}
                                    onClick={() => toggleScopeDimUserSort("status")}
                                    align="center"
                                    className="w-full"
                                  />
                                </th>
                                <th className="w-24 px-2 py-1 text-center text-xs font-semibold leading-tight whitespace-nowrap">Действия</th>
                              </tr>
                            </thead>
                          </table>
                        </div>
                        <div ref={dimTableBodyScrollRef} className="access-split-scroll-body" onScroll={onDimTableBodyScroll}>
                          <table className="access-split-scroll-table">
                            <AccessDimUsersColGroup />
                            <tbody>
                              {scopeDimPadTop > 0 ? (
                                <tr aria-hidden>
                                  <td
                                    colSpan={6}
                                    style={{ height: scopeDimPadTop, padding: 0, border: "none", lineHeight: 0 }}
                                  />
                                </tr>
                              ) : null}
                              {scopeDimVirtualItems.map((vi) => {
                                const u = displayCashUsers[vi.index];
                                if (!u) return null;
                                const full = opModalUsersById.get(u.id);
                                const kind = tab as ScopeDimensionTab;
                                const scopeRowHasAttachment =
                                  full && selectedDimension
                                    ? buildScopeDimensionPatchBody(kind, selectedDimension.key, full, false) !== null
                                    : false;
                                const scopeBusy =
                                  accessBulkSavePending || operationAccessMut.isPending || allUsersForOperationModalQ.isLoading;
                                return (
                                  <tr key={vi.key} className="border-t border-border/50" data-index={vi.index}>
                                    <td className="access-matrix-col-select py-1.5 text-center align-middle">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 accent-teal-700"
                                        checked={scopeDimBulkSel.has(u.id)}
                                        disabled={scopeBusy}
                                        onChange={(e) => {
                                          setScopeDimBulkSel((prev) => {
                                            const n = new Set(prev);
                                            if (e.target.checked) n.add(u.id);
                                            else n.delete(u.id);
                                            return n;
                                          });
                                        }}
                                        aria-label={`Выбрать: ${u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}`}
                                      />
                                    </td>
                                    <td className="min-w-0 px-2 py-1.5 align-middle leading-snug">{u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}</td>
                                    <td className="px-2 py-1.5 align-middle text-[11px] whitespace-nowrap">{u.role}</td>
                                    <td className="truncate px-2 py-1.5 align-middle text-[11px] text-muted-foreground" title={u.position || undefined}>
                                      {u.position || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-center align-middle">
                                      <span
                                        className={
                                          u.is_active
                                            ? "inline-block rounded-md bg-emerald-600/15 px-1 py-0.5 text-[9px] font-medium text-emerald-800 dark:text-emerald-200"
                                            : "inline-block rounded-md bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
                                        }
                                      >
                                        {u.is_active ? "Активный" : "Неактивный"}
                                      </span>
                                    </td>
                                    <td className="w-24 px-2 py-1.5 text-center align-middle">
                                      {scopeRowHasAttachment ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 min-w-0 border-teal-600/45 px-1.5 text-[10px] text-teal-950 hover:bg-teal-500/10 dark:text-emerald-100"
                                          disabled={scopeBusy || !full}
                                          onClick={() => void detachScopeUser(u)}
                                        >
                                          Открепить
                                        </Button>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {scopeDimPadBot > 0 ? (
                                <tr aria-hidden>
                                  <td
                                    colSpan={6}
                                    style={{ height: scopeDimPadBot, padding: 0, border: "none", lineHeight: 0 }}
                                  />
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {scopeDimBulkSel.size > 0 ? (
                        <AccessBulkBottomBar
                          variant="scope"
                          selectedCount={scopeDimBulkSel.size}
                          totalVisibleCount={filteredCashUsers.length}
                          onClear={() => setScopeDimBulkSel(new Set())}
                          busy={accessBulkSavePending || operationAccessMut.isPending || allUsersForOperationModalQ.isLoading}
                          onDetach={() => void bulkDetachScopeDimLinks()}
                        />
                      ) : null}
                    </div>
                    )}
                </div>
                ) : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {tab === "users" && selectedKey && !selected
                  ? "Пользователь не найден в списке (обновите поиск или фильтр)."
                  : `Выберите запись в «${activeTabLabel}» слева.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={opUsersModalOpen}
        onOpenChange={(open) => {
          setOpUsersModalOpen(open);
          if (!open) {
            setOpUsersModalSearch("");
            setOpUsersModalShowSelected(false);
          }
        }}
      >
        <DialogContent
          showCloseButton
          overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
          className={cn(
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-4 shadow-lg sm:max-w-[min(48rem,calc(100vw-2rem))]"
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-border/80 pb-3 text-left">
            <div className="flex items-start justify-between gap-4 pr-8">
              <DialogTitle className="min-w-0 flex-1 break-words text-left text-base font-semibold leading-snug">
                {accessWorkspaceUserPickerModalTitle(usersModalKind, selectedDimension?.label)}
              </DialogTitle>
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                Выделено: {opUsersModalSelected.size}
              </span>
            </div>
            <DialogDescription className="sr-only">
              {usersModalKind === "operations"
                ? "Выбор пользователей и включение или отключение операции. Сохранение отправляет изменения одним запросом."
                : "Выбор сотрудников для привязки к объекту доступа. Сохранение отправляет изменения одним запросом."}
            </DialogDescription>
            <p className="pt-2 text-left text-xs leading-relaxed text-muted-foreground">
              {usersModalKind === "operations"
                ? "Отметьте, у кого включить или выключить операцию (с учётом роли). «Сохранить» — одним запросом."
                : "Отметьте сотрудников для привязки к объекту. Снятие галочки — только от этого объекта."}
            </p>
          </DialogHeader>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden pb-1 pt-2">
            {modalGrantValidationError ? (
              <p className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {modalGrantValidationError}
              </p>
            ) : null}
            <p className="shrink-0 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs text-foreground">
              {modalBulkSummaryText}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1 text-xs"
                disabled={modalRoleKeys.length === 0 || allUsersForOperationModalQ.isLoading}
                onClick={() => {
                  if (modalRoleKeys.length === 0) return;
                  if (allModalGroupsExpanded) setOpUsersModalExpandedRoles(new Set());
                  else setOpUsersModalExpandedRoles(new Set(modalRoleKeys));
                }}
              >
                <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {allModalGroupsExpanded ? "Свернуть все" : "Развернуть все"}
              </Button>
              <div className="relative min-w-[10rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={opUsersModalSearch}
                  onChange={(e) => setOpUsersModalSearch(e.target.value)}
                  placeholder="Поиск"
                  className="h-8 w-full pl-8 text-xs"
                  aria-label="Поиск по сотрудникам"
                  disabled={allUsersForOperationModalQ.isLoading}
                />
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
                <IndeterminateCheckbox
                  checked={allVisibleModalSelected}
                  indeterminate={allVisibleModalSomeSelected}
                  disabled={allVisibleModalUserIds.length === 0 || allUsersForOperationModalQ.isLoading}
                  aria-label="Выбрать всех видимых в списке"
                  onChange={(e) => toggleModalSelectAllVisible(e.target.checked)}
                />
                Выбрать все
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                disabled={allUsersForOperationModalQ.isLoading}
                onClick={() => setOpUsersModalSelected(new Set())}
              >
                Сбросить выбор
              </Button>
            </div>
            <div className="scrollbar-none flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/15">
              <div className="scrollbar-none max-h-[min(52vh,440px)] min-h-[220px] flex-1 overflow-auto p-2">
              {allUsersForOperationModalQ.isLoading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                  <span>Загрузка пользователей…</span>
                </div>
              ) : opModalRoleGroups.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {opModalUsers.length ? "Никого не найдено по фильтру" : "Нет пользователей"}
                </p>
              ) : (
                <div className="space-y-0">
                  {opModalRoleGroups.map((g: { role: string; users: AccessUserRow[] }) => {
                    const expanded = opUsersModalExpandedRoles.has(g.role);
                    const allChecked = g.users.length > 0 && g.users.every((u) => opUsersModalSelected.has(u.id));
                    const someChecked = g.users.some((u) => opUsersModalSelected.has(u.id)) && !allChecked;
                    return (
                      <div key={g.role} className="border-b border-border/40 last:border-b-0">
                        <div className="flex items-center gap-0.5 py-1 pr-0.5">
                          <button
                            type="button"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            onClick={() => toggleModalRoleExpanded(g.role)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight">
                            {accessModalRoleGroupLabel(g.role)}
                            <span className="ml-1 font-normal text-muted-foreground">({g.users.length})</span>
                          </span>
                          <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap py-0.5 text-xs text-muted-foreground">
                            <IndeterminateCheckbox
                              checked={allChecked}
                              indeterminate={someChecked}
                              disabled={g.users.length === 0 || allUsersForOperationModalQ.isLoading}
                              aria-label={`Выбрать всех в группе ${accessModalRoleGroupLabel(g.role)}`}
                              onChange={(e) => toggleModalSelectRole(g.role, e.target.checked)}
                            />
                            Выбрать все
                          </label>
                        </div>
                        {expanded ? (
                          <div className="ml-3 space-y-0 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                            {g.users.map((u: AccessUserRow) => {
                              const lockGrantAdd =
                                usersModalKind === "operations" &&
                                Boolean(selectedDimension) &&
                                selectedDimension!.key !== ACCESS_MANAGE_KEY &&
                                !u.has_access_manage &&
                                !(opUsersById.get(u.id) && getOpEffective(opUsersById.get(u.id)!));
                              const lockModalGrant = lockGrantAdd;
                              const primary = accessModalUserPrimaryLine(u);
                              const branch = accessModalUserBranchLine(u);
                              return (
                                <label
                                  key={u.id}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1",
                                    u.status !== "active" && "opacity-75",
                                    lockModalGrant && !opUsersModalSelected.has(u.id) && "cursor-not-allowed opacity-60"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                    checked={opUsersModalSelected.has(u.id)}
                                    disabled={lockModalGrant && !opUsersModalSelected.has(u.id)}
                                    title={
                                      lockModalGrant && !opUsersModalSelected.has(u.id)
                                        ? "Сначала включите «Доступ: управление» (access.manage) у этого пользователя."
                                        : undefined
                                    }
                                    onChange={(e) =>
                                      setOpUsersModalSelected((prev) => {
                                        const n = new Set(prev);
                                        if (e.target.checked) n.add(u.id);
                                        else n.delete(u.id);
                                        return n;
                                      })
                                    }
                                  />
                                  <span className="min-w-0 text-sm leading-snug">
                                    <span className="font-medium text-foreground">{primary}</span>
                                    {branch ? (
                                      <span className="mt-0.5 block text-[11px] text-muted-foreground">— {branch}</span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex flex-col-reverse gap-3 border-t border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground sm:mr-auto">
              <input
                type="checkbox"
                className="accent-teal-700"
                checked={opUsersModalShowSelected}
                disabled={allUsersForOperationModalQ.isLoading}
                onChange={(e) => setOpUsersModalShowSelected(e.target.checked)}
              />
              Показать только выбранные
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={operationAccessMut.isPending || accessBulkSavePending}
                onClick={() => setOpUsersModalOpen(false)}
              >
                Отменить
              </Button>
              <Button
                type="button"
                className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60"
                disabled={
                  operationAccessMut.isPending ||
                  accessBulkSavePending ||
                  !selectedDimension ||
                  modalBulkItems.length === 0 ||
                  Boolean(modalGrantValidationError) ||
                  allUsersForOperationModalQ.isLoading
                }
                title={
                  modalGrantValidationError
                    ? modalGrantValidationError
                    : modalBulkItems.length === 0
                      ? "Нет отличий от текущих настроек"
                      : undefined
                }
                onClick={() => void saveOperationUsersModal()}
              >
                {operationAccessMut.isPending || accessBulkSavePending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Сохранение…
                  </>
                ) : modalBulkItems.length > 0 ? (
                  `Сохранить (${modalBulkItems.length})`
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
