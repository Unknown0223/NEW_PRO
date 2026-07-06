"use client";

import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction
} from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, Loader2, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import {
  normalizeAccessGrantPermissions,
  buildGrantDelegationPatchBody,
  chunkGrantDelegationPatchBodies,
  parseGrantDelegationPatch,
  grantDelegationKeysNeedingChange,
  applyGrantDelegationDetailCache
} from "@/components/access/access-workspace.shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { TableSortButton, type TableSortDir } from "@/components/ui/table-sort-button";
import { cn } from "@/lib/utils";
import { formatPersonDisplayName } from "@/lib/person-display";
import {
  isGrantedMatrixRow,
  isMatrixRowBulkSelectable,
  matchesPermissionSourceFilter,
  permissionSourceLabel,
  type PermissionSourceFilter
} from "@/lib/access-user-permission-matrix";

type MatrixRow = {
  key: string;
  module: string;
  section: string | null;
  description: string | null;
  parent_path: string;
  from_role: boolean;
  user_effect: "none" | "allow" | "deny";
  effective: boolean;
  /** Shaxsiy: ushbu operatsiyani boshqalarga berish huquqi (rolga bog‘lanmaydi). */
  can_grant_others: boolean;
};

function userMessageAfterAccessPatchFailure(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
  if (flat) {
    const hint = firstValidationUserHint(flat);
    return withApiSupportLine(hint ?? "Ma’lumotlarni tekshiring.", err);
  }
  return getUserFacingError(err, fallback);
}

type MatrixSortKey = "description" | "parent" | "section";

type ModalPickRow = { key: string; label: string; sub: string };

const matrixCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

function compareMatrixRows(a: MatrixRow, b: MatrixRow, key: MatrixSortKey, dir: TableSortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  const va =
    key === "description"
      ? displayAccessDescriptionShort(a.description, a.key)
      : key === "parent"
        ? (a.parent_path ?? "").trim()
        : (a.section ?? "").trim();
  const vb =
    key === "description"
      ? displayAccessDescriptionShort(b.description, b.key)
      : key === "parent"
        ? (b.parent_path ?? "").trim()
        : (b.section ?? "").trim();
  const c = matrixCollator.compare(va, vb) * mult;
  if (c !== 0) return c;
  return matrixCollator.compare(a.key, b.key);
}

type DetailResponse = {
  user: {
    id: number;
    login: string;
    full_name: string;
    code: string | null;
    role: string;
    status: "active" | "inactive";
    branch: string | null;
    supervisor_user_id: number | null;
  };
  matrix: MatrixRow[];
  /** Operatsiya kalitlari — foydalanuvchi boshqalarga berishi mumkin (mustaqil ro‘yxat). */
  grant_delegation_operation_keys?: string[];
  supervisees: { id: number; login: string; name: string; code: string | null; role: string; is_active: boolean }[];
  scope: {
    branches: string[];
    warehouses: number[];
    cash_desks: number[];
    payment_methods: string[];
    trade_directions?: number[];
    territories: number[];
  };
};

type DimRow = { key: string; label: string; attached_users_count: number; is_active: boolean };

/** Ответ GET /access/territories — плоский список. */
type TerritoryApiRow = {
  id: number;
  key: string;
  label: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

/** GET /access/users?mode=supervisor_pick */
type SupervisorPickRow = {
  id: number;
  full_name: string;
  code: string | null;
  role: string;
  is_active: boolean;
  supervisor_user_id: number | null;
  branch: string | null;
};

const STAFF_ROLE_ORDER = ["admin", "supervisor", "agent", "expeditor", "manager"];

function staffRoleGroupLabel(role: string): string {
  const r = role.toLowerCase().trim();
  const map: Record<string, string> = {
    admin: "Администраторы",
    supervisor: "Супервайзеры",
    agent: "Агенты",
    expeditor: "Экспедиторы",
    manager: "Менеджеры"
  };
  return map[r] ?? role;
}

function uniqRoleKeys(roles: string[]): string[] {
  return [...new Set(roles)];
}

function sortStaffRoleKeys(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    const ia = STAFF_ROLE_ORDER.indexOf(la);
    const ib = STAFF_ROLE_ORDER.indexOf(lb);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return la.localeCompare(lb, "ru", { sensitivity: "base", numeric: true });
  });
}

function formatStaffPickLine(u: SupervisorPickRow): string {
  const name = formatPersonDisplayName({ fio: u.full_name, name: u.full_name });
  return name || `#${u.id}`;
}

/** Дерево из `tenant.settings.references.territory_nodes` (как на странице Territoriya). */
type AccessTerritoryTreeNode = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  children: AccessTerritoryTreeNode[];
};

type AccessTerritoriesCatalog = {
  flat: TerritoryApiRow[];
  tree: AccessTerritoryTreeNode[];
};

function collectSubtreeTerritoryIdStrings(n: AccessTerritoryTreeNode): string[] {
  const k = String(n.id);
  const ch = n.children ?? [];
  if (ch.length === 0) return [k];
  return [k, ...ch.flatMap(collectSubtreeTerritoryIdStrings)];
}

function flattenTerritoryTreeIdStrings(nodes: AccessTerritoryTreeNode[]): string[] {
  return nodes.flatMap(collectSubtreeTerritoryIdStrings);
}

function sortedTerritoryTreeLevel(nodes: AccessTerritoryTreeNode[]): AccessTerritoryTreeNode[] {
  return [...nodes].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base", numeric: true })
  );
}

/** Макрозона: FV-…, а также SOUTH-WEST-… (первые два сегмента кода). */
function territoryGroupKey(code: string | null | undefined): string {
  const c = code?.trim();
  if (!c) return "Прочее";
  const parts = c.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "Прочее";

  const pairSecond = parts[1]?.toUpperCase();
  if (
    parts.length >= 3 &&
    pairSecond &&
    ["WEST", "EAST", "NORTH", "SOUTH", "CENTRAL"].includes(pairSecond)
  ) {
    return `${parts[0]!.toUpperCase()}-${parts[1]!.toUpperCase()}`;
  }

  if (parts.length >= 2) {
    return parts[0]!.toUpperCase();
  }

  if (/^[A-Za-z][A-Za-z0-9_-]{0,14}$/.test(parts[0]!)) {
    return parts[0]!.toUpperCase();
  }
  return "Прочее";
}

/** Регион под зоной (следующий сегмент кода после префикса группы). */
function territorySubgroupKey(code: string | null | undefined, groupKey: string): string {
  const c = code?.trim();
  if (!c) return "";
  const parts = c.split("-").map((p) => p.trim()).filter(Boolean);
  const gParts = groupKey.split("-").filter(Boolean);
  if (parts.length <= gParts.length) return "";
  for (let i = 0; i < gParts.length; i++) {
    if (parts[i]?.toUpperCase() !== gParts[i]?.toUpperCase()) return "";
  }
  return parts[gParts.length]?.toUpperCase() ?? "";
}

/** Показ зоны / области: дефис и подчёркивание → пробелы и «·», без сырых кодов в одну строку. */
function humanizeHierarchyLabel(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/_/g, " ")
    .replace(/-/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

function territoryZoneLabel(groupKey: string): string {
  if (groupKey === "Прочее") return "Прочее";
  return humanizeHierarchyLabel(groupKey);
}

type TerritorySubgroupNode = {
  key: string;
  label: string;
  items: TerritoryApiRow[];
};

type TerritoryGroupNode = {
  group: string;
  subgroups: TerritorySubgroupNode[];
};

function buildTerritoryGroups(rows: TerritoryApiRow[]): { group: string; items: TerritoryApiRow[] }[] {
  const map = new Map<string, TerritoryApiRow[]>();
  for (const r of rows) {
    const g = territoryGroupKey(r.code);
    const arr = map.get(g) ?? [];
    arr.push(r);
    map.set(g, arr);
  }
  const entries = Array.from(map.entries());
  for (let i = 0; i < entries.length; i++) {
    const pair = entries[i]!;
    pair[1].sort((a: TerritoryApiRow, b: TerritoryApiRow) => a.name.localeCompare(b.name, "ru"));
  }
  return entries
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([group, items]) => ({ group, items }));
}

function buildTerritoryHierarchy(rows: TerritoryApiRow[]): TerritoryGroupNode[] {
  const flatGroups = buildTerritoryGroups(rows);
  return flatGroups.map(({ group, items }) => {
    const subMap = new Map<string, TerritoryApiRow[]>();
    for (const r of items) {
      const sk = territorySubgroupKey(r.code, group);
      const bucket = sk || "__direct__";
      const arr = subMap.get(bucket) ?? [];
      arr.push(r);
      subMap.set(bucket, arr);
    }
    const subgroups: TerritorySubgroupNode[] = [];
    for (const [key, its] of subMap.entries()) {
      its.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      const label = key === "__direct__" ? "" : humanizeHierarchyLabel(key);
      subgroups.push({ key, label, items: its });
    }
    subgroups.sort((a, b) => {
      if (a.key === "__direct__") return 1;
      if (b.key === "__direct__") return -1;
      return (a.label || a.key).localeCompare(b.label || b.key, "ru");
    });
    return { group, subgroups };
  });
}

/** Только название города/узла (из справочника); код не показываем — в крайнем случае смягчённый разбор поля кода. */
function territoryLeafNameOnly(r: TerritoryApiRow): string {
  const name = (r.name ?? "").trim();
  if (name) return name;
  const lb = (r.label ?? "").trim();
  const i = lb.lastIndexOf("(");
  if (i > 0) return lb.slice(0, i).trim();
  if (lb) return lb;
  const c = (r.code ?? "").trim();
  return c ? humanizeHierarchyLabel(c) : "—";
}

function formatTerritoryAssigneeSubtitle(u: DetailResponse["user"]): string {
  const name = (u.full_name || u.login || "").trim();
  const code = u.code?.trim();
  const branch = u.branch?.trim();
  if (code) {
    let s = `[${code}]- ${name}`;
    if (branch) s += ` - [${branch}]`;
    return s;
  }
  if (branch) return `${name} - [${branch}]`;
  return name;
}

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

function TerritoryReferenceTreeRows({
  nodes,
  depth,
  treeExpanded,
  setTreeExpanded,
  modalSel,
  setModalSel,
  territoryDisabled
}: {
  nodes: AccessTerritoryTreeNode[];
  depth: number;
  treeExpanded: Set<number>;
  setTreeExpanded: Dispatch<SetStateAction<Set<number>>>;
  modalSel: Set<string>;
  setModalSel: Dispatch<SetStateAction<Set<string>>>;
  territoryDisabled: boolean;
}) {
  const sorted = sortedTerritoryTreeLevel(nodes);
  return (
    <div className={cn("space-y-0", depth > 0 && "mt-0.5 border-l border-dashed border-border/45 pl-2.5")}>
      {sorted.map((node) => {
        const ch = node.children ?? [];
        const hasChildren = ch.length > 0;
        const open = treeExpanded.has(node.id);
        const desc = collectSubtreeTerritoryIdStrings(node);
        const allIn = desc.length > 0 && desc.every((id) => modalSel.has(id));
        const someIn = desc.some((id) => modalSel.has(id)) && !allIn;

        return (
          <div key={node.id} className={cn("py-0.5", !node.is_active && "opacity-70")}>
            <div className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
                disabled={!hasChildren}
                aria-expanded={hasChildren ? open : undefined}
                aria-label={open ? "Свернуть" : "Развернуть"}
                onClick={() => {
                  if (!hasChildren) return;
                  setTreeExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
              >
                {hasChildren ? (
                  open ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                <IndeterminateCheckbox
                  checked={allIn}
                  indeterminate={someIn}
                  disabled={territoryDisabled}
                  onChange={(e) => {
                    setModalSel((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) for (const id of desc) n.add(id);
                      else for (const id of desc) n.delete(id);
                      return n;
                    });
                  }}
                />
                <span
                  className="min-w-0 text-sm font-semibold uppercase tracking-wide text-foreground [overflow-wrap:anywhere] sm:truncate"
                  title={node.code ? `${node.name} · ${node.code}` : node.name}
                >
                  {(node.name || "—").trim()}
                </span>
              </label>
            </div>
            {hasChildren && open ? (
              <TerritoryReferenceTreeRows
                nodes={ch}
                depth={depth + 1}
                treeExpanded={treeExpanded}
                setTreeExpanded={setTreeExpanded}
                modalSel={modalSel}
                setModalSel={setModalSel}
                territoryDisabled={territoryDisabled}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function patchTouchesUserDirectory(body: Record<string, unknown>): boolean {
  if (body.role != null || body.is_active != null) return true;
  if (
    body.branch_codes != null ||
    body.warehouse_ids != null ||
    body.warehouse_delegate != null ||
    body.cash_desk_ids != null ||
    body.payment_methods != null ||
    body.trade_direction_ids != null ||
    body.territory_ids != null ||
    body.supervisee_user_ids != null
  )
    return true;
  return false;
}

type InnerTab =
  | "territories"
  | "staff"
  | "operations"
  | "cash_desks"
  | "warehouses"
  | "branches"
  | "payment_methods"
  | "trade_directions";

/** Длинные parent_path в option раздувают нативный select — короткая подпись, полный путь в title. */
function shortenPathLabel(path: string, max = 40): string {
  const t = path.trim();
  if (t.length <= max) return t;
  const head = Math.max(8, Math.floor(max * 0.55));
  const tail = max - head - 1;
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

/** Один PATCH для массового включения/выключения эффективного доступа по списку строк (как toggleRow по каждой). */
function buildBulkEffectivePatchBody(rows: MatrixRow[], wantEffective: boolean): Record<string, unknown> | null {
  const remove_permission_keys: string[] = [];
  const permissions: string[] = [];
  const denied_permissions: string[] = [];
  if (wantEffective) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.effective) continue;
      if (row.user_effect === "deny") {
        if (row.from_role) remove_permission_keys.push(row.key);
        else permissions.push(row.key);
      } else {
        permissions.push(row.key);
      }
    }
  } else {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (!row.effective) continue;
      /** Всегда явный deny у пользователя — чтобы «Открепить» оставался и снимал override (как при снятии с роли). */
      denied_permissions.push(row.key);
    }
  }
  const uniq = (a: string[]) => [...new Set(a)];
  const rmk = uniq(remove_permission_keys);
  const per = uniq(permissions);
  const den = uniq(denied_permissions);
  const body: Record<string, unknown> = {};
  if (rmk.length) body.remove_permission_keys = rmk;
  if (per.length || den.length) {
    body.merge_permissions = true;
    if (per.length) body.permissions = per;
    if (den.length) body.denied_permissions = den;
  }
  if (!body.remove_permission_keys && !body.merge_permissions) return null;
  return body;
}

export type AccessUserAccountControls = {
  isActive: boolean;
  onToggle: () => void;
  /** Только указанный пользователь; вызывать с `userId` панели. */
  onReset: (userId: number) => void | Promise<void>;
  togglePending: boolean;
  resetPending: boolean;
};

export function AccessUserDetailPanel({
  tenantSlug,
  userId,
  onInvalidateUsers,
  userAccountControls
}: {
  tenantSlug: string;
  userId: number;
  onInvalidateUsers: () => void;
  /** «Доступ» / пользователи: отключить и сброс — в строке фильтра «Операции». */
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
      const { data } = await api.get<{ data: TerritoryApiRow[]; tree?: AccessTerritoryTreeNode[] }>(
        `/api/${tenantSlug}/access/territories`
      );
      return {
        flat: data.data,
        tree: Array.isArray(data.tree) ? data.tree : []
      };
    },
    enabled: Boolean(tenantSlug) && modal === "territory",
    /** Каталог редко меняется; сервер тоже кеширует ответ по digest. */
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
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
      if (body.supervisee_user_ids != null) {
        void qc.invalidateQueries({ queryKey: ["access-users-supervisor-pick", tenantSlug] });
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
      const v = row.parent_path?.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [grantedMatrix]);

  const filteredMatrix = useMemo(() => {
    const p = filterParent.trim();
    const q = tableSearch.trim().toLowerCase();
    return grantedMatrix.filter((row) => {
      if (p && row.parent_path !== p) return false;
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
    const m = new Map<string, MatrixRow[]>();
    for (const row of sortedFilteredMatrix) {
      const k = row.parent_path?.trim() || "—";
      const arr = m.get(k) ?? [];
      arr.push(row);
      m.set(k, arr);
    }
    const keys = [...m.keys()].sort((a, b) => matrixCollator.compare(a, b));
    return keys
      .map((parent) => ({ parent, rows: m.get(parent)! }))
      .filter((g) => g.rows.length > 0);
  }, [sortedFilteredMatrix]);

  const matrixParentKeysSig = useMemo(
    () => JSON.stringify(matrixRowGroups.map((g) => g.parent)),
    [matrixRowGroups]
  );
  /** По умолчанию все группы свёрнуты; «Развернуть» в фильтре или шеврон у группы. */
  useEffect(() => {
    setMatrixGroupExpanded(new Set());
  }, [userId, matrixParentKeysSig]);

  const matrixGroupsAllExpanded = useMemo(
    () => matrixRowGroups.length > 0 && matrixRowGroups.every((g) => matrixGroupExpanded.has(g.parent)),
    [matrixRowGroups, matrixGroupExpanded]
  );

  const toggleMatrixGroupsExpandCollapse = useCallback(() => {
    const allKeys = matrixRowGroups.map((g) => g.parent);
    if (allKeys.length === 0) return;
    setMatrixGroupExpanded((prev) => {
      const allOpen = allKeys.every((k) => prev.has(k));
      if (allOpen) return new Set<string>();
      return new Set(allKeys);
    });
  }, [matrixRowGroups]);

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
      if (row.user_effect !== "none") remove_permission_keys.push(row.key);
      else denied_permissions.push(row.key);
    }

    const body: Record<string, unknown> = {};
    if (remove_permission_keys.length) body.remove_permission_keys = remove_permission_keys;
    if (denied_permissions.length) {
      body.merge_permissions = true;
      body.denied_permissions = denied_permissions;
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
      .map((r) => ({
        key: r.key,
        label: displayAccessDescriptionShort(r.description, r.key),
        sub: r.parent_path
      }));
  }, [modal, catalogQ.data, matrixByKey]);

  const filteredAttachModalItems = useMemo((): ModalPickRow[] => {
    const q = modalSearch.trim().toLowerCase();
    let rows = attachModalBaseItems;
    if (q) rows = rows.filter((x) => `${x.key} ${x.label} ${x.sub}`.toLowerCase().includes(q));
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

  const opAttachGroups = useMemo(() => {
    if (modal !== "operations") return [] as { parent: string; items: ModalPickRow[] }[];
    const m = new Map<string, ModalPickRow[]>();
    for (const it of filteredAttachModalItems) {
      const k = (it.sub ?? "").trim() || "—";
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    const keys = [...m.keys()].sort((a, b) => matrixCollator.compare(a, b));
    return keys.map((parent) => ({ parent, items: m.get(parent)! }));
  }, [modal, filteredAttachModalItems]);

  const opAttachGroupKeys = useMemo(() => opAttachGroups.map((g) => g.parent), [opAttachGroups]);
  const allOpAttachGroupsExpanded =
    opAttachGroupKeys.length > 0 && opAttachGroupKeys.every((k) => opAttachGroupExpanded.has(k));

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

  if (detailQ.isError) {
    return <p className="px-4 pt-16 text-sm text-destructive">Не удалось загрузить данные доступа</p>;
  }
  if (detailQ.isLoading || !user) {
    return <p className="px-4 pt-16 text-sm text-muted-foreground">Загрузка…</p>;
  }

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

  const modalUserLabel = user.code
    ? `[${user.code}] • ${user.full_name || user.login}`
    : user.full_name || user.login;

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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={`access-hub-toolbar w-full shrink-0 shadow-none flex flex-wrap items-center gap-2 ${inner === "operations" ? "justify-between" : ""}`}
      >
        {inner === "operations" ? (
          <div className="relative min-w-[10rem] max-w-xs flex-1 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 text-xs"
              placeholder="Поиск"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              aria-label="Поиск по таблице операций"
            />
          </div>
        ) : null}
        <nav
          className={cn(
            "flex flex-wrap gap-1",
            inner === "operations" ? "min-w-0 flex-1 justify-end" : "w-full"
          )}
        >
          {innerTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-active={
                (t.id === "territories" && modal === "territory") ||
                (t.id === "staff" && modal === "staff") ||
                (t.id === "operations" && inner === "operations") ||
                (t.id === "cash_desks" && modal === "cash") ||
                (t.id === "warehouses" && modal === "warehouse") ||
                (t.id === "branches" && modal === "branch") ||
                (t.id === "payment_methods" && modal === "payment") ||
                (t.id === "trade_directions" && modal === "direction")
              }
              className={cn(
                "access-tab-chip text-xs",
                (t.id === "territories" && modal === "territory") ||
                  (t.id === "staff" && modal === "staff") ||
                  (t.id === "operations" && inner === "operations") ||
                  (t.id === "cash_desks" && modal === "cash") ||
                  (t.id === "warehouses" && modal === "warehouse") ||
                  (t.id === "branches" && modal === "branch") ||
                  (t.id === "payment_methods" && modal === "payment") ||
                  (t.id === "trade_directions" && modal === "direction")
                  ? ""
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              onClick={() => {
                if (t.id === "territories") {
                  openModal("territory");
                  return;
                }
                if (t.id === "staff") {
                  /** Как «Территории»: только модалка, без смены вкладки — матрица «Операции» остаётся под оверлеем. */
                  openModal("staff");
                  return;
                }
                if (t.id === "cash_desks") {
                  openModal("cash");
                  return;
                }
                if (t.id === "warehouses") {
                  openModal("warehouse");
                  return;
                }
                if (t.id === "branches") {
                  openModal("branch");
                  return;
                }
                if (t.id === "payment_methods") {
                  openModal("payment");
                  return;
                }
                if (t.id === "trade_directions") {
                  openModal("direction");
                  return;
                }
                if (t.id === "operations") {
                  setInner("operations");
                  setModal(null);
                  return;
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 p-3",
          inner === "operations"
            ? "flex flex-col overflow-hidden overscroll-contain"
            : "overflow-y-auto overflow-x-hidden overscroll-contain"
        )}
      >
        {inner === "operations" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="shrink-0 rounded-md border border-border/60 bg-card p-2 shadow-sm">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                  Показаны только операции, которые пользователь может выполнять. Базовые права — из роли;
                  дополнительные назначаются через «Добавить операции». Колонка «Предоставление доступа» —
                  может ли этот аккаунт выдавать каждую операцию другим (только для него, не через роль).
                  Снять саму операцию — «Открепить» / «Снять».
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 shrink-0 gap-1 bg-teal-700 px-2.5 text-[11px] text-white hover:bg-teal-800"
                  onClick={() => openModal("operations")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Добавить операции
                </Button>
              </div>
              <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
              <div className="flex w-full flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-2">
                  <button
                    type="button"
                    title={
                      matrixGroupsAllExpanded
                        ? "Свернуть все группы в таблице"
                        : "Развернуть все группы в таблице"
                    }
                    aria-expanded={matrixGroupsAllExpanded}
                    disabled={matrixRowGroups.length === 0}
                    onClick={toggleMatrixGroupsExpandCollapse}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium shadow-sm transition-colors",
                      matrixRowGroups.length === 0 && "cursor-not-allowed opacity-50",
                      matrixGroupsAllExpanded
                        ? "border-teal-700/35 bg-teal-600 text-white hover:bg-teal-700"
                        : "border-sky-600/40 bg-sky-600 text-white hover:bg-sky-700"
                    )}
                  >
                    {matrixGroupsAllExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="max-sm:sr-only">{matrixGroupsAllExpanded ? "Свернуть" : "Развернуть"}</span>
                  </button>
                  <div className="min-w-0 sm:max-w-[min(100%,16rem)]">
                    <label htmlFor="access-page-filter-parent" className="sr-only">
                      Родитель
                    </label>
                    <select
                      id="access-page-filter-parent"
                      className="access-filter-select w-full max-w-[16rem]"
                      value={filterParentDraft}
                      onChange={(e) => setFilterParentDraft(e.target.value)}
                      title={
                        filterParentDraft.trim()
                          ? filterParentDraft
                          : "Родитель — без ограничения (все разделы)"
                      }
                    >
                      <option value="" title="Без ограничения по разделу">
                        Родитель
                      </option>
                      {parentOptions.map((opt) => (
                        <option key={opt} value={opt} title={opt}>
                          {shortenPathLabel(opt)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="shrink-0">
                    <label htmlFor="access-page-filter-source" className="sr-only">
                      Источник
                    </label>
                    <select
                      id="access-page-filter-source"
                      className="access-filter-select access-filter-select--fixed w-full min-w-[11rem] sm:w-auto"
                      value={filterSourceDraft}
                      onChange={(e) => setFilterSourceDraft(e.target.value as PermissionSourceFilter)}
                      title={
                        filterSourceDraft === "all"
                          ? "Источник — все активные"
                          : filterSourceDraft === "role"
                            ? "Только из роли (базовые)"
                            : "Только дополнительно назначенные"
                      }
                    >
                      <option value="all" title="Все активные операции">
                        Источник
                      </option>
                      <option value="role">Из роли</option>
                      <option value="extra">Дополнительно</option>
                    </select>
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap items-end justify-end gap-1.5 self-end">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-teal-700 px-3 text-[11px] text-white hover:bg-teal-800"
                    onClick={() => {
                      setFilterParent(filterParentDraft);
                      setFilterSource(filterSourceDraft);
                    }}
                  >
                    Применить
                  </Button>
                  {userAccountControls ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={userAccountControls.togglePending}
                        className={cn(
                          "h-7 px-2.5 text-[11px] font-medium text-white shadow-sm",
                          userAccountControls.isActive
                            ? "border-0 bg-amber-600 hover:bg-amber-700"
                            : "border-0 bg-emerald-600 hover:bg-emerald-700"
                        )}
                        onClick={() => void userAccountControls.onToggle()}
                      >
                        {userAccountControls.isActive ? "Отключить" : "Включить"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={userAccountControls.resetPending}
                        className="h-7 border-0 bg-rose-600 px-2.5 text-[11px] font-medium text-white shadow-sm hover:bg-rose-700"
                        onClick={() => void userAccountControls.onReset(userId)}
                      >
                        Сбросить
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {bulkFeedback ? (
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "shrink-0 rounded-md border px-2 py-1 text-xs",
                  bulkFeedback.tone === "ok"
                    ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                )}
              >
                {bulkFeedback.text}
              </p>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="access-split-scroll-panel min-h-0 flex-1">
              {matrixRowGroups.length === 0 ? (
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center">
                  <p className="max-w-md text-sm text-muted-foreground">
                    У пользователя пока нет активных операций — только базовые права роли или доступ ещё не назначен.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-teal-700 text-white hover:bg-teal-800"
                    onClick={() => openModal("operations")}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Добавить операции
                  </Button>
                </div>
              ) : (
              <>
              <div ref={matrixHeadScrollRef} className="access-split-scroll-head" onScroll={onMatrixHeadScroll}>
                <table className="access-matrix-table">
                  <colgroup>
                    <col className="w-8" />
                    <col className="min-w-[8rem]" />
                    <col className="min-w-[6rem] w-[10rem]" />
                    <col className="min-w-[8rem] w-[12rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[10rem]" />
                    <col className="w-[8.5rem]" />
                  </colgroup>
                  <thead className="app-table-thead">
                    <tr>
                      <th scope="col" className="access-matrix-col-select py-1">
                        <span className="sr-only">Выбор строк для массовых действий</span>
                        <input
                          ref={bulkHeaderCheckboxRef}
                          type="checkbox"
                          className={`h-3.5 w-3.5 ${bulkSelectableKeys.length > 0 ? "accent-teal-700" : "cursor-not-allowed opacity-40"}`}
                          checked={bulkSelectableKeys.length > 0 ? bulkHeaderAllSelected : false}
                          disabled={patchMut.isPending || bulkSelectableKeys.length === 0}
                          onChange={(e) => toggleBulkAll(e.target.checked)}
                          title={
                            bulkSelectableKeys.length > 0
                              ? "Выбрать все видимые строки для массового включения/выключения или открепления"
                              : "Нет строк для массового выбора — включите «Доступ: управление» или выберите пользователя с активными операциями"
                          }
                          aria-label={
                            bulkSelectableKeys.length > 0
                              ? "Выбрать все видимые строки для массовых действий"
                              : "Нет строк для массового выбора"
                          }
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <TableSortButton
                          label="Описание"
                          active={matrixSort?.key === "description"}
                          dir={matrixSort?.key === "description" ? matrixSort.dir : "asc"}
                          onClick={() => toggleMatrixSort("description")}
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <TableSortButton
                          label="Родитель"
                          active={matrixSort?.key === "parent"}
                          dir={matrixSort?.key === "parent" ? matrixSort.dir : "asc"}
                          onClick={() => toggleMatrixSort("parent")}
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <TableSortButton
                          label="Раздел"
                          active={matrixSort?.key === "section"}
                          dir={matrixSort?.key === "section" ? matrixSort.dir : "asc"}
                          onClick={() => toggleMatrixSort("section")}
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <span title="Роль — базовые права; Дополнительно — назначено вручную">Источник</span>
                      </th>
                      <th
                        scope="col"
                        className="w-[10rem] px-1.5 py-1 text-center align-middle text-[10px] font-semibold leading-tight"
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                          <span
                            className="w-full max-w-[10rem] px-0.5 text-center text-[9px] font-semibold leading-snug sm:text-[10px]"
                            title="Может выдавать эту операцию другим пользователям в «Доступ» (только для этого аккаунта)"
                          >
                            Предоставление доступа
                          </span>
                          {tableMatrix.length > 0 ? (
                            <label className="relative mx-auto flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                              <input
                                ref={grantHeaderSwitchRef}
                                type="checkbox"
                                role="switch"
                                aria-checked={grantHeaderAllOn}
                                className="peer sr-only"
                                checked={grantHeaderAllOn}
                                disabled={patchMut.isPending}
                                title={
                                  bulkSel.size > 0
                                    ? "Разрешить или запретить выдачу доступа другим — для выбранных операций"
                                    : "Разрешить или запретить выдачу доступа другим — для всех видимых операций"
                                }
                                onChange={(e) => void bulkApplyGrantDelegation(e.target.checked)}
                              />
                              <span
                                className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50"
                                aria-hidden
                              />
                              <span
                                className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                                aria-hidden
                              />
                            </label>
                          ) : null}
                        </div>
                      </th>
                      <th scope="col" className="w-[8.5rem] px-2 py-1 text-center align-middle text-[10px] font-semibold leading-tight">
                        Действия
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div ref={matrixBodyScrollRef} className="access-split-scroll-body" onScroll={onMatrixBodyScroll}>
                <table className="access-matrix-table">
                  <colgroup>
                    <col className="w-8" />
                    <col className="min-w-[8rem]" />
                    <col className="min-w-[6rem] w-[10rem]" />
                    <col className="min-w-[8rem] w-[12rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[10rem]" />
                    <col className="w-[8.5rem]" />
                  </colgroup>
                  <tbody>
                    {matrixRowGroups.map((grp) => {
                      const groupKey = grp.parent.trim() || "—";
                      const open = matrixGroupExpanded.has(groupKey);
                      const groupSelectableKeys = grp.rows.filter(isRowBulkSelectable).map((r) => r.key);
                      const groupAllSelected =
                        groupSelectableKeys.length > 0 && groupSelectableKeys.every((k) => bulkSel.has(k));
                      const groupSomeSelected =
                        groupSelectableKeys.length > 0 &&
                        groupSelectableKeys.some((k) => bulkSel.has(k)) &&
                        !groupAllSelected;
                      return (
                        <Fragment key={grp.parent}>
                          <tr className="border-t border-border/60 bg-muted/35">
                            <td className="access-matrix-col-select py-1 align-middle">
                              <div className="flex items-center justify-center px-0.5">
                                <IndeterminateCheckbox
                                  checked={groupAllSelected}
                                  indeterminate={groupSomeSelected}
                                  disabled={patchMut.isPending || groupSelectableKeys.length === 0}
                                  className="h-3.5 w-3.5"
                                  title={
                                    groupSelectableKeys.length === 0
                                      ? "В группе нет строк для массового выбора"
                                      : groupAllSelected
                                        ? "Снять выбор со всех строк группы"
                                        : "Выбрать все доступные строки группы"
                                  }
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleBulkGroup(grp, e.target.checked);
                                  }}
                                  aria-label={`Массовый выбор группы: ${shortenPathLabel(grp.parent)}`}
                                />
                              </div>
                            </td>
                            <td
                              colSpan={6}
                              className="cursor-pointer px-2 py-1"
                              onClick={() =>
                                setMatrixGroupExpanded((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(groupKey)) n.delete(groupKey);
                                  else n.add(groupKey);
                                  return n;
                                })
                              }
                            >
                              <div className="flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-[11px] font-semibold text-foreground hover:bg-muted/40">
                                {open ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                )}
                                <span className="min-w-0 truncate" title={grp.parent}>
                                  {shortenPathLabel(grp.parent)}
                                </span>
                                <span className="shrink-0 font-normal text-muted-foreground">({grp.rows.length})</span>
                              </div>
                            </td>
                          </tr>
                          {open
                            ? grp.rows.map((row) => {
                                const rowSelectable = isRowBulkSelectable(row);
                                return (
                                <tr key={row.key} className="border-t border-border/50 transition-colors hover:bg-muted/25">
                                  <td className="access-matrix-col-select py-2">
                                    <input
                                      type="checkbox"
                                      className={`h-4 w-4 ${rowSelectable ? "accent-teal-700" : "cursor-not-allowed opacity-45"}`}
                                      checked={rowSelectable ? bulkSel.has(row.key) : false}
                                      disabled={patchMut.isPending || !rowSelectable}
                                      title="Выбрать для массового запрета или открепления личной настройки"
                                      aria-label={
                                        rowSelectable
                                          ? `Выбрать строку: ${displayAccessDescriptionShort(row.description, row.key)}`
                                          : `Массовый выбор недоступен: ${displayAccessDescriptionShort(row.description, row.key)}`
                                      }
                                      onChange={(e) => {
                                        if (!rowSelectable) return;
                                        const n = new Set(bulkSel);
                                        if (e.target.checked) n.add(row.key);
                                        else n.delete(row.key);
                                        setBulkSel(n);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="min-w-0 break-words px-2 py-2 align-middle leading-snug"
                                    title={(row.description && row.description.trim()) || undefined}
                                  >
                                    {displayAccessDescriptionShort(row.description, row.key)}
                                  </td>
                                  <td
                                    className="min-w-0 break-words px-2 py-2 align-middle leading-snug text-muted-foreground"
                                    title={row.parent_path?.trim() || undefined}
                                  >
                                    {row.parent_path?.trim() || "—"}
                                  </td>
                                  <td
                                    className="min-w-0 break-words px-2 py-2 align-middle leading-snug text-muted-foreground"
                                    title={(row.section && row.section.trim()) || undefined}
                                  >
                                    {displayAccessDescriptionShort(row.section, "—")}
                                  </td>
                                  <td className="px-2 py-2 align-middle text-[11px]">
                                    <span
                                      className={cn(
                                        "inline-flex rounded px-1.5 py-0.5 font-medium",
                                        row.user_effect === "allow"
                                          ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                                          : "bg-muted/80 text-muted-foreground"
                                      )}
                                      title={
                                        row.user_effect === "allow"
                                          ? "Назначено дополнительно (не только роль)"
                                          : "Базовое право из роли пользователя"
                                      }
                                    >
                                      {permissionSourceLabel(row)}
                                    </span>
                                  </td>
                                  <td className="w-[10rem] px-2 py-2 text-center align-middle">
                                    <label className="relative mx-auto flex h-6 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                                      <input
                                        type="checkbox"
                                        role="switch"
                                        aria-checked={row.can_grant_others}
                                        aria-label={`${row.can_grant_others ? "Может выдавать другим" : "Не может выдавать другим"}: ${displayAccessDescriptionShort(row.description, row.key)}`}
                                        className="peer sr-only"
                                        checked={row.can_grant_others}
                                        disabled={patchMut.isPending}
                                        title={
                                          row.can_grant_others
                                            ? "Может выдавать эту операцию другим. Выключить — только право выдачи (сама операция остаётся)"
                                            : "Разрешить этому аккаунту выдавать эту операцию другим пользователям"
                                        }
                                        onChange={(e) => void toggleRowGrantDelegation(row, e.target.checked)}
                                      />
                                      <span
                                        className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50"
                                        aria-hidden
                                      />
                                      <span
                                        className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                                        aria-hidden
                                      />
                                    </label>
                                  </td>
                                  <td className="w-[8.5rem] px-2 py-2 text-center align-middle">
                                    {row.effective ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 min-w-[6.5rem] border-teal-600/45 px-2 text-[11px] text-teal-950 hover:bg-teal-500/10 dark:text-emerald-100"
                                        disabled={patchMut.isPending}
                                        title={
                                          row.user_effect !== "none"
                                            ? "Снять личную настройку (дополнительно назначенное)"
                                            : "Запретить для этого пользователя (роль не меняется)"
                                        }
                                        onClick={() => {
                                          if (row.user_effect !== "none") {
                                            void patchMut.mutateAsync({ remove_permission_keys: [row.key] });
                                            return;
                                          }
                                          void patchMut.mutateAsync({
                                            merge_permissions: true,
                                            denied_permissions: [row.key]
                                          });
                                        }}
                                      >
                                        {row.user_effect !== "none" ? "Открепить" : "Снять"}
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                              })
                            : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              )}
            </div>
            {bulkSel.size > 0 ? (
              <AccessBulkBottomBar
                variant="operations"
                selectedCount={bulkSel.size}
                totalVisibleCount={bulkSelectableKeys.length}
                onClear={() => setBulkSel(new Set())}
                busy={patchMut.isPending}
                denyTitle="Запретить выбранные операции (снять эффект)"
                onDeny={() => void bulkApplyFilteredEffective(false)}
                onDetach={() => void bulkDetach()}
                detachDisabled={selectedDetachableCount === 0}
                detachTitle={
                  selectedDetachableCount === 0
                    ? "Выберите активные операции для снятия доступа у этого пользователя"
                    : "Снять доступ у выбранных (личные — открепить, из роли — запретить только этому аккаунту)"
                }
                detachWithLinkIcon
              />
            ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(modal)} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent
          overlayClassName={
            assignPickModal
              ? "z-[100] bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
              : undefined
          }
          className={cn(
            "max-h-[90vh] overflow-hidden shadow-lg",
            assignPickModal
              ? "z-[101] sm:max-w-[min(42rem,calc(100vw-2rem))]"
              : modal === "operations"
                ? "sm:max-w-2xl"
                : "sm:max-w-lg"
          )}
          showCloseButton
        >
          {assignPickModal ? (
            <DialogHeader className="space-y-0 border-b border-border/80 pb-3 text-left">
              <div className="flex items-start justify-between gap-4 pr-8">
                <DialogTitle className="min-w-0 flex-1 break-words text-left text-base font-semibold leading-snug">
                  {modal === "territory" ? (
                    <>Прикрепить территории: {formatTerritoryAssigneeSubtitle(user)}</>
                  ) : modal === "staff" ? (
                    <>Прикрепить пользователи: {formatTerritoryAssigneeSubtitle(user)}</>
                  ) : modal === "cash" ? (
                    <>Прикрепить кассу: {formatTerritoryAssigneeSubtitle(user)}</>
                  ) : modal === "warehouse" ? (
                    <>Прикрепить склад: {formatTerritoryAssigneeSubtitle(user)}</>
                  ) : modal === "branch" ? (
                    <>Прикрепить филиал: {formatTerritoryAssigneeSubtitle(user)}</>
                  ) : (
                    <>Прикрепить способ оплаты: {formatTerritoryAssigneeSubtitle(user)}</>
                  )}
                </DialogTitle>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  Выделено: {modalSel.size}
                </span>
              </div>
            </DialogHeader>
          ) : (
            <DialogHeader className="space-y-0 border-b border-border/80 pb-3 text-left">
              <div className="flex items-start justify-between gap-4 pr-8">
                <DialogTitle className="text-left text-base font-semibold leading-snug">{modalTitle}</DialogTitle>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  Выделено: {modalSel.size}
                </span>
              </div>
            </DialogHeader>
          )}

          {modal === "territory" ? (
            <div className="flex min-h-0 flex-col">
              <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {territoriesQ.isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                    <span>Загрузка территорий…</span>
                  </div>
                ) : !(territoryCatalog?.flat?.length ?? 0) ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Нет доступных территорий</p>
                ) : (
                  <>
                    <label className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-1 py-2">
                      <IndeterminateCheckbox
                        checked={
                          visibleTerritoryLeafKeys.length > 0 &&
                          visibleTerritoryLeafKeys.every((k) => modalSel.has(k))
                        }
                        indeterminate={
                          visibleTerritoryLeafKeys.some((k) => modalSel.has(k)) &&
                          !(
                            visibleTerritoryLeafKeys.length > 0 &&
                            visibleTerritoryLeafKeys.every((k) => modalSel.has(k))
                          )
                        }
                        disabled={
                          patchMut.isPending || territoriesQ.isLoading || visibleTerritoryLeafKeys.length === 0
                        }
                        onChange={(e) => {
                          const n = new Set(modalSel);
                          if (e.target.checked) {
                            for (const k of visibleTerritoryLeafKeys) n.add(k);
                          } else {
                            for (const k of visibleTerritoryLeafKeys) n.delete(k);
                          }
                          setModalSel(n);
                        }}
                      />
                      <span className="text-sm font-medium">Выбрать всё</span>
                    </label>
                    <div className="pt-1">
                      {useReferenceTerritoryTree ? (
                        <TerritoryReferenceTreeRows
                          nodes={referenceTerritoryTree}
                          depth={0}
                          treeExpanded={treeExpanded}
                          setTreeExpanded={setTreeExpanded}
                          modalSel={modalSel}
                          setModalSel={setModalSel}
                          territoryDisabled={patchMut.isPending || territoriesQ.isLoading}
                        />
                      ) : (
                      territoryHierarchy.map((g) => {
                        const expanded = territoryExpanded.has(g.group);
                        const groupLeafKeys = g.subgroups.flatMap((s) => s.items.map((r) => String(r.id)));
                        const allInGroup =
                          groupLeafKeys.length > 0 && groupLeafKeys.every((k) => modalSel.has(k));
                        const someInGroup =
                          groupLeafKeys.some((k) => modalSel.has(k)) && !allInGroup;
                        return (
                          <div key={g.group} className="border-b border-border/40 last:border-b-0">
                            <div className="flex items-center gap-0.5 py-1">
                              <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                                onClick={() =>
                                  setTerritoryExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(g.group)) next.delete(g.group);
                                    else next.add(g.group);
                                    return next;
                                  })
                                }
                                aria-expanded={expanded}
                                aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                              >
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                                <IndeterminateCheckbox
                                  checked={allInGroup}
                                  indeterminate={someInGroup}
                                  disabled={patchMut.isPending || territoriesQ.isLoading}
                                  onChange={(e) => {
                                    const n = new Set(modalSel);
                                    if (e.target.checked) {
                                      for (const k of groupLeafKeys) n.add(k);
                                    } else {
                                      for (const k of groupLeafKeys) n.delete(k);
                                    }
                                    setModalSel(n);
                                  }}
                                />
                                <span className="text-sm font-semibold tracking-tight">{territoryZoneLabel(g.group)}</span>
                              </label>
                            </div>
                            {expanded ? (
                              <div className="ml-3 space-y-1 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                                {g.subgroups.map((sub) => {
                                  const subKeys = sub.items.map((r) => String(r.id));
                                  const subAll = subKeys.length > 0 && subKeys.every((k) => modalSel.has(k));
                                  const subSome =
                                    subKeys.some((k) => modalSel.has(k)) && !subAll;
                                  const subKeyFull = `${g.group}::${sub.key}`;
                                  const subOpen =
                                    sub.key === "__direct__" ? true : territorySubExpanded.has(subKeyFull);

                                  const leafBlock = (
                                    <div
                                      className={cn(
                                        "space-y-0",
                                        sub.key !== "__direct__" &&
                                          "mt-0.5 border-l border-dashed border-border/50 pl-3"
                                      )}
                                    >
                                      {sub.items.map((r) => (
                                        <label
                                          key={r.id}
                                          className={cn(
                                            "flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1",
                                            sub.key !== "__direct__" && "pl-1",
                                            !r.is_active && "opacity-75"
                                          )}
                                        >
                                          <input
                                            type="checkbox"
                                            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                            disabled={patchMut.isPending || territoriesQ.isLoading}
                                            checked={modalSel.has(String(r.id))}
                                            title={
                                              r.code
                                                ? `${territoryLeafNameOnly(r)} · ${r.code}`
                                                : territoryLeafNameOnly(r)
                                            }
                                            onChange={(e) => {
                                              const n = new Set(modalSel);
                                              const k = String(r.id);
                                              if (e.target.checked) n.add(k);
                                              else n.delete(k);
                                              setModalSel(n);
                                            }}
                                          />
                                          <span className="min-w-0 text-sm leading-snug">
                                            <span className="font-medium text-foreground">{territoryLeafNameOnly(r)}</span>
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  );

                                  if (sub.key === "__direct__") {
                                    return <div key={`${g.group}::__direct__`}>{leafBlock}</div>;
                                  }

                                  return (
                                    <div key={sub.key} className="pb-1">
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                                          onClick={() =>
                                            setTerritorySubExpanded((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(subKeyFull)) next.delete(subKeyFull);
                                              else next.add(subKeyFull);
                                              return next;
                                            })
                                          }
                                          aria-expanded={subOpen}
                                          aria-label={subOpen ? "Свернуть регион" : "Развернуть регион"}
                                        >
                                          {subOpen ? (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                                          <IndeterminateCheckbox
                                            checked={subAll}
                                            indeterminate={subSome}
                                            disabled={patchMut.isPending || territoriesQ.isLoading}
                                            onChange={(e) => {
                                              const n = new Set(modalSel);
                                              if (e.target.checked) {
                                                for (const k of subKeys) n.add(k);
                                              } else {
                                                for (const k of subKeys) n.delete(k);
                                              }
                                              setModalSel(n);
                                            }}
                                          />
                                          <span className="text-sm font-semibold tracking-tight text-foreground">
                                            {sub.label || sub.key}
                                          </span>
                                        </label>
                                      </div>
                                      {subOpen ? leafBlock : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : modal === "staff" ? (
            <div className="flex min-h-0 flex-col gap-2 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1 text-xs"
                  disabled={
                    patchMut.isPending ||
                    staffPickBootstrapping ||
                    !(supervisorPickQ.data?.length ?? 0)
                  }
                  onClick={() => toggleExpandCollapseStaffRoles()}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {allStaffGroupsInViewExpanded ? "Свернуть все" : "Развернуть все"}
                </Button>
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск"
                    className="h-8 w-full pl-8 text-xs"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    aria-label="Поиск по сотрудникам"
                  />
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
                  <IndeterminateCheckbox
                    checked={
                      visibleStaffPickIds.length > 0 &&
                      visibleStaffPickIds.every((k) => modalSel.has(k))
                    }
                    indeterminate={
                      visibleStaffPickIds.some((k) => modalSel.has(k)) &&
                      !(
                        visibleStaffPickIds.length > 0 &&
                        visibleStaffPickIds.every((k) => modalSel.has(k))
                      )
                    }
                    disabled={
                      patchMut.isPending || staffPickBootstrapping || visibleStaffPickIds.length === 0
                    }
                    onChange={(e) => {
                      const n = new Set(modalSel);
                      if (e.target.checked) {
                        for (const k of visibleStaffPickIds) n.add(k);
                      } else {
                        for (const k of visibleStaffPickIds) n.delete(k);
                      }
                      setModalSel(n);
                    }}
                  />
                  Выбрать все
                </label>
              </div>
              <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {staffPickBootstrapping ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                    <span>Загрузка пользователей…</span>
                  </div>
                ) : staffPickByRole.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {supervisorPickQ.data?.length ? "Никого не найдено по фильтру" : "Нет пользователей"}
                  </p>
                ) : (
                  <div className="space-y-0">
                    {staffPickByRole.map(({ role, items }) => {
                      const expanded = staffRoleExpanded.includes(role);
                      const leafKeys = items.map((u) => String(u.id));
                      const allIn = leafKeys.length > 0 && leafKeys.every((k) => modalSel.has(k));
                      const someIn = leafKeys.some((k) => modalSel.has(k)) && !allIn;
                      return (
                        <div key={role} className="border-b border-border/40 last:border-b-0">
                          <div className="flex items-center gap-0.5 py-1 pr-0.5">
                            <button
                              type="button"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                              onClick={() =>
                                setStaffRoleExpanded((prev) =>
                                  prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                                )
                              }
                              aria-expanded={expanded}
                              aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight">
                              {staffRoleGroupLabel(role)}
                            </span>
                            <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap py-0.5 text-xs text-muted-foreground">
                              <IndeterminateCheckbox
                                checked={allIn}
                                indeterminate={someIn}
                                disabled={patchMut.isPending || staffPickBootstrapping}
                                onChange={(e) => {
                                  const n = new Set(modalSel);
                                  if (e.target.checked) {
                                    for (const k of leafKeys) n.add(k);
                                  } else {
                                    for (const k of leafKeys) n.delete(k);
                                  }
                                  setModalSel(n);
                                }}
                              />
                              Выбрать все
                            </label>
                          </div>
                          {expanded ? (
                            <div className="ml-3 space-y-0 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                              {items.map((u) => (
                                <label
                                  key={u.id}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1",
                                    !u.is_active && "opacity-75"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                    disabled={patchMut.isPending || staffPickBootstrapping}
                                    checked={modalSel.has(String(u.id))}
                                    onChange={(e) => {
                                      const n = new Set(modalSel);
                                      const k = String(u.id);
                                      if (e.target.checked) n.add(k);
                                      else n.delete(k);
                                      setModalSel(n);
                                    }}
                                  />
                                  <span className="min-w-0 text-sm leading-snug">
                                    <span className="font-medium text-foreground">{formatStaffPickLine(u)}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : modal === "operations" ? (
            <div className="flex flex-col gap-2 overflow-hidden">
              <p className="text-[11px] text-muted-foreground">
                Доступно для добавления: {attachModalBaseItems.length}. Выберите операции сверх базовых прав роли — они
                будут назначены только этому пользователю.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={opAttachGroupKeys.length === 0}
                  onClick={() => {
                    if (opAttachGroupKeys.length === 0) return;
                    if (allOpAttachGroupsExpanded) setOpAttachGroupExpanded(new Set());
                    else setOpAttachGroupExpanded(new Set(opAttachGroupKeys));
                  }}
                >
                  {allOpAttachGroupsExpanded ? "Свернуть все" : "Развернуть все"}
                </Button>
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск"
                    className="h-8 w-full pl-8 text-xs"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                </div>
                <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={showSelOnly} onChange={(e) => setShowSelOnly(e.target.checked)} />
                  Показать только выбранные
                </label>
              </div>
              <div className="max-h-[48vh] overflow-auto rounded border border-border/60 p-2">
                {catalogQ.isLoading ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Загрузка каталога…</p>
                ) : opAttachGroups.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    {attachModalBaseItems.length === 0
                      ? "Все операции из каталога уже доступны пользователю или добавление ограничено."
                      : "Ничего не найдено по фильтру"}
                  </p>
                ) : (
                  opAttachGroups.map((grp) => {
                  const expanded = opAttachGroupExpanded.has(grp.parent);
                  const groupKeys = grp.items.map((item) => item.key);
                  const groupAllSelected =
                    groupKeys.length > 0 && groupKeys.every((k) => modalSel.has(k));
                  const groupSomeSelected =
                    groupKeys.length > 0 && groupKeys.some((k) => modalSel.has(k)) && !groupAllSelected;
                  return (
                    <div key={grp.parent} className="border-b border-border/40 py-1 last:border-b-0">
                      <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold"
                          onClick={() =>
                            setOpAttachGroupExpanded((prev) => {
                              const n = new Set(prev);
                              if (n.has(grp.parent)) n.delete(grp.parent);
                              else n.add(grp.parent);
                              return n;
                            })
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <span className="min-w-0 truncate" title={grp.parent}>
                            {shortenPathLabel(grp.parent)}
                          </span>
                          <span className="shrink-0 font-normal text-muted-foreground">({grp.items.length})</span>
                        </button>
                        <IndeterminateCheckbox
                          checked={groupAllSelected}
                          indeterminate={groupSomeSelected}
                          disabled={patchMut.isPending || groupKeys.length === 0}
                          className="h-4 w-4 shrink-0 accent-teal-700"
                          title={`Выбрать все операции категории «${shortenPathLabel(grp.parent)}»`}
                          aria-label={`Выбрать все операции категории: ${shortenPathLabel(grp.parent)}`}
                          onChange={(e) => toggleOpAttachGroup(grp.items, e.target.checked)}
                        />
                      </div>
                      {expanded ? (
                        <div className="mt-0.5 space-y-0 border-l border-border/45 pl-2">
                          {grp.items.map((item) => (
                              <label
                                key={item.key}
                                className="flex cursor-pointer items-start gap-2 border-b border-border/30 py-1.5 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 accent-teal-700"
                                  disabled={patchMut.isPending}
                                  checked={modalSel.has(item.key)}
                                  title="Дополнительная операция только для этого пользователя"
                                  onChange={(e) => {
                                    const n = new Set(modalSel);
                                    if (e.target.checked) n.add(item.key);
                                    else n.delete(item.key);
                                    setModalSel(n);
                                  }}
                                />
                                <span className="text-xs">
                                  <span className="font-medium">{item.label}</span>
                                  {item.sub ? (
                                    <span className="ml-2 block text-muted-foreground">
                                      <span className="font-medium text-foreground/80">Родитель:</span> {item.sub}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          ) : dimPickModal ? (
            <div className="flex min-h-0 flex-col gap-2 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по названию"
                    className="h-8 w-full pl-8 text-xs"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    aria-label="Поиск по списку объектов"
                  />
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
                  <IndeterminateCheckbox
                    checked={dimPickAllSelected}
                    indeterminate={dimPickSomeSelected}
                    disabled={patchMut.isPending || dimQ.isLoading || visibleDimPickKeys.length === 0}
                    onChange={(e) => {
                      const n = new Set(modalSel);
                      if (e.target.checked) {
                        for (const k of visibleDimPickKeys) n.add(k);
                      } else {
                        for (const k of visibleDimPickKeys) n.delete(k);
                      }
                      setModalSel(n);
                    }}
                  />
                  Выбрать все
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={showSelOnly}
                  onChange={(e) => setShowSelOnly(e.target.checked)}
                />
                Показать только выбранные
              </label>
              <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {dimQ.isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                    <span>Загрузка списка…</span>
                  </div>
                ) : filteredModalItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Ничего не найдено</p>
                ) : (
                  <div className="space-y-0">
                    {filteredModalItems.map((item) => {
                      const count = item.sub.trim();
                      return (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-2 border-b border-border/40 py-2 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                            disabled={patchMut.isPending}
                            checked={modalSel.has(item.key)}
                            onChange={(e) => {
                              const n = new Set(modalSel);
                              if (e.target.checked) n.add(item.key);
                              else n.delete(item.key);
                              setModalSel(n);
                            }}
                          />
                          <span className="min-w-0 text-sm leading-snug">
                            <span className="font-medium text-foreground">{item.label}</span>
                            {count ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                Пользователей с доступом к объекту:{" "}
                                <span className="tabular-nums text-foreground/80">{count}</span>
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter
            className={cn(
              "gap-2 border-t border-border/80 pt-3",
              modal === "staff"
                ? "flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between"
                : "sm:justify-end"
            )}
          >
            {modal === "staff" ? (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground sm:mr-auto">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={showSelOnly}
                  onChange={(e) => setShowSelOnly(e.target.checked)}
                />
                Показать только выбранные
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setModal(null)}>
                Отменить
              </Button>
              <Button
                className="bg-teal-700 text-white hover:bg-teal-800"
                type="button"
                disabled={
                  patchMut.isPending ||
                  (modal === "operations" && catalogQ.isLoading) ||
                  (modal === "territory" && territoriesQ.isLoading) ||
                  (modal === "staff" && staffPickBootstrapping) ||
                  (dimPickModal && dimQ.isLoading)
                }
                onClick={() => void saveModal()}
              >
                {patchMut.isPending ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
