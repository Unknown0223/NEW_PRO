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
import { ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
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

type MatrixRow = {
  key: string;
  module: string;
  section: string | null;
  description: string | null;
  parent_path: string;
  from_role: boolean;
  user_effect: "none" | "allow" | "deny";
  effective: boolean;
};

const ACCESS_MANAGE_KEY = "access.manage";

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
  supervisees: { id: number; login: string; name: string; code: string | null; role: string; is_active: boolean }[];
  scope: {
    branches: string[];
    warehouses: number[];
    cash_desks: number[];
    payment_methods: string[];
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
  const name = (u.full_name || "").trim();
  const code = u.code?.trim();
  const branch = u.branch?.trim();
  let s = `${u.id}`;
  if (code) s += ` [${code}]`;
  if (name) s += ` ${name}`;
  if (branch) s += ` - [${branch}]`;
  return s.trim();
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
  | "payment_methods";

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

function computePermissionPatch(matrix: MatrixRow[], selected: Set<string>) {
  const remove_permission_keys: string[] = [];
  const permissions: string[] = [];
  const denied_permissions: string[] = [];
  const byKey = new Map(matrix.map((r) => [r.key, r]));
  const keys = new Set<string>([...matrix.map((r) => r.key), ...selected]);
  for (const key of keys) {
    const row = byKey.get(key);
    const want = selected.has(key);
    if (!row) {
      if (want) permissions.push(key);
      continue;
    }
    if (want === row.effective) continue;
    if (want) {
      if (row.user_effect === "deny") {
        if (row.from_role) remove_permission_keys.push(row.key);
        else permissions.push(row.key);
      } else if (!row.from_role) permissions.push(row.key);
    } else {
      denied_permissions.push(row.key);
    }
  }
  return { remove_permission_keys, permissions, denied_permissions };
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
  const [filterGrant, setFilterGrant] = useState<"all" | "allowed" | "denied">("all");
  /** «Предоставление доступа» filtri: qator uchun ustun-переключатель mavjudligi (`canUsePredostRow`). */
  const [filterPredost, setFilterPredost] = useState<"all" | "can" | "cannot">("all");
  const [filterParentDraft, setFilterParentDraft] = useState("");
  const [filterGrantDraft, setFilterGrantDraft] = useState<"all" | "allowed" | "denied">("all");
  const [filterPredostDraft, setFilterPredostDraft] = useState<"all" | "can" | "cannot">("all");
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

  const [modal, setModal] = useState<null | "operations" | "cash" | "warehouse" | "branch" | "payment" | "territory" | "staff">(null);
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
    setFilterGrant("all");
    setFilterPredost("all");
    setFilterParentDraft("");
    setFilterGrantDraft("all");
    setFilterPredostDraft("all");
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
  const allTerritoryRows = territoryCatalog?.flat ?? [];
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
    enabled: Boolean(tenantSlug) && (modal === "cash" || modal === "warehouse" || modal === "branch" || modal === "payment"),
    queryFn: async () => {
      const type =
        modal === "cash"
          ? "cash_desks"
          : modal === "warehouse"
            ? "warehouses"
            : modal === "branch"
              ? "branches"
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

  const matrix = detailQ.data?.matrix ?? [];
  const matrixByKey = useMemo(() => new Map(matrix.map((r) => [r.key, r] as const)), [matrix]);
  const user = detailQ.data?.user;
  const scope = detailQ.data?.scope;

  /** «Доступ: управление» — boshqa операцияларни бириктириш / UI «Предоставление доступа». */
  const targetHasAccessManage = useMemo(
    () => matrix.some((r) => r.key === ACCESS_MANAGE_KEY && r.effective),
    [matrix]
  );

  const canUsePredostRow = useCallback(
    (row: MatrixRow) => row.key === ACCESS_MANAGE_KEY || targetHasAccessManage,
    [targetHasAccessManage]
  );

  const parentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const row of matrix) {
      const v = row.parent_path?.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [matrix]);

  const filteredMatrix = useMemo(() => {
    const p = filterParent.trim();
    const q = tableSearch.trim().toLowerCase();
    return matrix.filter((row) => {
      if (p && row.parent_path !== p) return false;
      if (filterGrant === "allowed" && !row.effective) return false;
      if (filterGrant === "denied" && row.effective) return false;
      if (filterPredost === "can" && !canUsePredostRow(row)) return false;
      if (filterPredost === "cannot" && canUsePredostRow(row)) return false;
      if (q) {
        const hay = `${row.key} ${row.description ?? ""} ${row.parent_path} ${row.section ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matrix, filterParent, filterGrant, filterPredost, tableSearch, canUsePredostRow]);

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
    () => tableMatrix.filter((r) => r.user_effect !== "none").map((r) => r.key),
    [tableMatrix]
  );

  const filterResetSig = `${userId}|${filterParent}|${filterGrant}|${filterPredost}`;
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
      const allowed = new Set(detachableKeys);
      const next = new Set<string>();
      const prevArr = Array.from(prev);
      for (let i = 0; i < prevArr.length; i++) {
        const k = prevArr[i]!;
        if (allowed.has(k)) next.add(k);
      }
      if (next.size === prev.size && prevArr.every((k) => next.has(k))) return prev;
      return next;
    });
  }, [filterResetSig, tableSearch, detachableKeys]);

  useEffect(() => {
    if (!bulkFeedback) return;
    const t = window.setTimeout(() => setBulkFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [bulkFeedback]);

  const bulkHeaderAllSelected = detachableKeys.length > 0 && detachableKeys.every((k) => bulkSel.has(k));
  const bulkHeaderSomeSelected =
    detachableKeys.length > 0 && detachableKeys.some((k) => bulkSel.has(k)) && !bulkHeaderAllSelected;

  useEffect(() => {
    const el = bulkHeaderCheckboxRef.current;
    if (el) el.indeterminate = bulkHeaderSomeSelected;
  }, [bulkHeaderSomeSelected]);

  const grantHeaderAllEffective =
    tableMatrix.length > 0 && tableMatrix.every((r) => r.effective);
  const grantHeaderSomeEffective = tableMatrix.some((r) => r.effective);
  const grantHeaderIndeterminate =
    tableMatrix.length > 0 && grantHeaderSomeEffective && !grantHeaderAllEffective;

  useEffect(() => {
    const el = grantHeaderSwitchRef.current;
    if (el) el.indeterminate = grantHeaderIndeterminate;
  }, [grantHeaderIndeterminate]);

  const bulkApplyFilteredEffective = async (wantEffective: boolean) => {
    let targetRows = bulkSel.size > 0 ? tableMatrix.filter((r) => bulkSel.has(r.key)) : tableMatrix;
    if (wantEffective) {
      targetRows = targetRows.filter((r) => canUsePredostRow(r) || r.effective);
    }
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
    const keys = Array.from(bulkSel).filter((k) => {
      const r = matrix.find((x) => x.key === k);
      return r && r.user_effect !== "none";
    });
    if (!keys.length) return;
    try {
      await patchMut.mutateAsync({ remove_permission_keys: keys });
      setBulkSel(new Set());
      setBulkFeedback({ tone: "ok", text: `Снято пользовательских настроек: ${keys.length}, одним запросом` });
    } catch (err) {
      setBulkFeedback({ tone: "err", text: userMessageAfterAccessPatchFailure(err, "Не удалось открепить. Попробуйте ещё раз.") });
    }
  };

  const toggleBulkAll = (checked: boolean) => {
    if (checked) setBulkSel(new Set(detachableKeys));
    else setBulkSel(new Set());
  };

  const toggleBulkGroup = useCallback((grp: { parent: string; rows: MatrixRow[] }, checked: boolean) => {
    const keys = grp.rows.filter((r) => r.user_effect !== "none").map((r) => r.key);
    if (keys.length === 0) return;
    setBulkSel((prev) => {
      const n = new Set(prev);
      if (checked) for (const k of keys) n.add(k);
      else for (const k of keys) n.delete(k);
      return n;
    });
  }, []);

  const openModal = (kind: typeof modal) => {
    setModal(kind);
    setModalSearch("");
    setShowSelOnly(false);
    if (kind === "operations") {
      if (detailQ.data) {
        const sel = new Set<string>();
        for (const r of detailQ.data.matrix) {
          if (suppressedMatrixKeys.has(r.key)) continue;
          if (r.effective) sel.add(r.key);
        }
        setModalSel(sel);
      } else {
        setModalSel(new Set());
      }
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
    if (modal === "operations") {
      return (catalogQ.data?.flat ?? []).map((r) => ({
        key: r.key,
        label: displayAccessDescriptionShort(r.description, r.key),
        sub: r.parent_path
      }));
    }
    if (modal === "territory") {
      return (territoriesQ.data?.flat ?? []).map((r: TerritoryApiRow) => ({
        key: r.key,
        label: territoryLeafNameOnly(r),
        sub: ""
      }));
    }
    return (dimQ.data ?? []).map((r) => ({ key: r.key, label: r.label, sub: String(r.attached_users_count) }));
  }, [modal, catalogQ.data, territoriesQ.data, dimQ.data]);

  const filteredModalItems = useMemo((): ModalPickRow[] => {
    const q = modalSearch.trim().toLowerCase();
    let rows: ModalPickRow[] = modalItems;
    if (modal === "operations") {
      const p = filterParent.trim();
      rows = modalItems.filter((x) => {
        const row = matrixByKey.get(x.key);
        const eff = row?.effective ?? false;
        if (p && (x.sub ?? "").trim() !== p) return false;
        if (filterGrant === "allowed" && !eff) return false;
        if (filterGrant === "denied" && eff) return false;
        const canPred = row ? canUsePredostRow(row) : false;
        if (filterPredost === "can" && !canPred) return false;
        if (filterPredost === "cannot" && canPred) return false;
        return true;
      });
    }
    if (q) rows = rows.filter((x) => `${x.key} ${x.label} ${x.sub}`.toLowerCase().includes(q));
    if (showSelOnly) rows = rows.filter((x) => modalSel.has(x.key));
    return rows;
  }, [
    modalItems,
    modalSearch,
    showSelOnly,
    modalSel,
    modal,
    filterParent,
    filterGrant,
    filterPredost,
    matrixByKey,
    canUsePredostRow
  ]);

  const dimPickModal = modal === "cash" || modal === "warehouse" || modal === "branch" || modal === "payment";

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
    for (const it of filteredModalItems) {
      const k = (it.sub ?? "").trim() || "—";
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    const keys = [...m.keys()].sort((a, b) => matrixCollator.compare(a, b));
    return keys.map((parent) => ({ parent, items: m.get(parent)! }));
  }, [modal, filteredModalItems]);

  const opAttachGroupKeys = useMemo(() => opAttachGroups.map((g) => g.parent), [opAttachGroups]);
  const allOpAttachGroupsExpanded =
    opAttachGroupKeys.length > 0 && opAttachGroupKeys.every((k) => opAttachGroupExpanded.has(k));

  useEffect(() => {
    if (modal !== "operations") return;
    setOpAttachGroupExpanded(new Set());
  }, [modal, userId]);

  const saveModal = async () => {
    if (modal === "operations" && detailQ.data) {
      const patch = computePermissionPatch(detailQ.data.matrix, modalSel);
      if (!targetHasAccessManage) {
        const newAllows = patch.permissions.filter((k) => k !== ACCESS_MANAGE_KEY);
        const enablesAccessManageNow = patch.permissions.includes(ACCESS_MANAGE_KEY);
        if (newAllows.length && !enablesAccessManageNow) {
          setBulkFeedback({
            tone: "err",
            text: "Сначала включите «Доступ: управление» (access.manage), затем добавляйте другие операции. Либо включите access.manage в этом же сохранении."
          });
          return;
        }
      }
      const body: Record<string, unknown> = {};
      if (patch.remove_permission_keys.length) body.remove_permission_keys = patch.remove_permission_keys;
      if (patch.permissions.length || patch.denied_permissions.length) {
        body.merge_permissions = true;
        if (patch.permissions.length) body.permissions = patch.permissions;
        if (patch.denied_permissions.length) body.denied_permissions = patch.denied_permissions;
      }
      if (Object.keys(body).length) await patchMut.mutateAsync(body);
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
    } else if (modal === "staff") {
      await patchMut.mutateAsync({
        supervisee_user_ids: [...modalSel].map(Number).filter((n) => Number.isInteger(n) && n > 0)
      });
    }
    setModal(null);
  };

  const toggleRow = useCallback(
    async (row: MatrixRow, next: boolean) => {
      const body = buildBulkEffectivePatchBody([row], next);
      if (!body) return;
      try {
        await patchMut.mutateAsync(body);
      } catch (err) {
        setBulkFeedback({ tone: "err", text: userMessageAfterAccessPatchFailure(err, "Не удалось сохранить") });
      }
    },
    [patchMut]
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
    { id: "payment_methods", label: "Способ оплаты" }
  ];

  const modalUserLabel = user.code
    ? `[${user.code}] • ${user.full_name || user.login}`
    : user.full_name || user.login;

  const modalTitle =
    modal === "operations"
      ? `Прикрепить операции: ${modalUserLabel}`
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
                : "";

  /** Модалки выбора привязок (как «Территории»): оверлей поверх матрицы, единый шаблон шапки и списка. */
  const assignPickModal =
    modal === "territory" ||
    modal === "staff" ||
    modal === "cash" ||
    modal === "warehouse" ||
    modal === "branch" ||
    modal === "payment";

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
                (t.id === "operations" && modal === "operations") ||
                (t.id === "cash_desks" && modal === "cash") ||
                (t.id === "warehouses" && modal === "warehouse") ||
                (t.id === "branches" && modal === "branch") ||
                (t.id === "payment_methods" && modal === "payment")
              }
              className={cn(
                "access-tab-chip text-xs",
                (t.id === "territories" && modal === "territory") ||
                  (t.id === "staff" && modal === "staff") ||
                  (t.id === "operations" && modal === "operations") ||
                  (t.id === "cash_desks" && modal === "cash") ||
                  (t.id === "warehouses" && modal === "warehouse") ||
                  (t.id === "branches" && modal === "branch") ||
                  (t.id === "payment_methods" && modal === "payment")
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
                if (t.id === "operations") {
                  setInner("operations");
                  openModal("operations");
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
                    <label htmlFor="access-page-filter-status" className="sr-only">
                      Статус
                    </label>
                    <select
                      id="access-page-filter-status"
                      className="access-filter-select access-filter-select--fixed w-full min-w-[11rem] sm:w-auto"
                      value={filterGrantDraft}
                      onChange={(e) => setFilterGrantDraft(e.target.value as "all" | "allowed" | "denied")}
                      title={
                        filterGrantDraft === "all"
                          ? "Статус — без фильтра"
                          : filterGrantDraft === "allowed"
                            ? "Только разрешённые"
                            : "Только запрещённые"
                      }
                    >
                      <option value="all" title="Без фильтра по статусу">
                        Статус
                      </option>
                      <option value="allowed">Разрешено</option>
                      <option value="denied">Запрещено</option>
                    </select>
                  </div>
                  <div className="shrink-0">
                    <label htmlFor="access-page-filter-predost" className="sr-only">
                      Предоставление доступа
                    </label>
                    <select
                      id="access-page-filter-predost"
                      className="access-filter-select w-full min-w-[13.5rem] max-w-[min(100%,18rem)] sm:w-auto"
                      value={filterPredostDraft}
                      onChange={(e) => setFilterPredostDraft(e.target.value as "all" | "can" | "cannot")}
                      title={
                        filterPredostDraft === "all"
                          ? "Предоставление доступа — без фильтра"
                          : filterPredostDraft === "can"
                            ? "Переключатель доступен"
                            : "Переключатель недоступен"
                      }
                    >
                      <option value="all" title="Без фильтра">
                        Предоставление доступа
                      </option>
                      <option value="can">Доступно</option>
                      <option value="cannot">Недоступно</option>
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
                      setFilterGrant(filterGrantDraft);
                      setFilterPredost(filterPredostDraft);
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
              <div ref={matrixHeadScrollRef} className="access-split-scroll-head" onScroll={onMatrixHeadScroll}>
                <table className="access-matrix-table">
                  <colgroup>
                    <col className="w-8" />
                    <col className="min-w-[8rem]" />
                    <col className="min-w-[6rem] w-[10rem]" />
                    <col className="min-w-[8rem] w-[12rem]" />
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
                          className={`h-3.5 w-3.5 ${detachableKeys.length > 0 ? "accent-teal-700" : "cursor-not-allowed opacity-40"}`}
                          checked={detachableKeys.length > 0 ? bulkHeaderAllSelected : false}
                          disabled={patchMut.isPending || detachableKeys.length === 0}
                          onChange={(e) => toggleBulkAll(e.target.checked)}
                          title={
                            detachableKeys.length > 0
                              ? "Выбрать все видимые строки с пользовательской настройкой (для открепления)"
                              : "Массовый выбор недоступен"
                          }
                          aria-label={
                            detachableKeys.length > 0
                              ? "Выбрать все видимые строки с пользовательской настройкой"
                              : "Нет строк с пользовательской настройкой для массового выбора"
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
                      <th
                        scope="col"
                        className="w-[10rem] px-1.5 py-1 text-center align-middle text-[10px] font-semibold leading-tight"
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                          <span
                            className="w-full max-w-[10rem] px-0.5 text-center text-[9px] font-semibold leading-snug sm:text-[10px]"
                            title="Выдача этой операции другим пользователям (в разделе «Доступ»). Доступно только при включённой операции «Доступ: управление»."
                          >
                            Предоставление доступа
                          </span>
                          {tableMatrix.length > 0 ? (
                            <label className="relative mx-auto flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                              <input
                                ref={grantHeaderSwitchRef}
                                type="checkbox"
                                role="switch"
                                aria-checked={grantHeaderAllEffective}
                                aria-label={
                                  bulkSel.size > 0
                                    ? "Предоставление доступа: включить или выключить для выбранных строк"
                                    : "Предоставление доступа: включить или выключить для всех видимых строк"
                                }
                                className="peer sr-only"
                                checked={grantHeaderAllEffective}
                                disabled={patchMut.isPending}
                                title={
                                  !targetHasAccessManage
                                    ? "Сначала включите «Доступ: управление» (access.manage), чтобы выдавать другие операции. Переключатель всё равно включает доступные строки (в т.ч. access.manage)."
                                    : bulkSel.size > 0
                                      ? "Предоставление доступа: разрешить или запретить для выбранных"
                                      : "Предоставление доступа: разрешить или запретить для всех видимых"
                                }
                                onChange={(e) => void bulkApplyFilteredEffective(e.target.checked)}
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
                    <col className="w-[10rem]" />
                    <col className="w-[8.5rem]" />
                  </colgroup>
                  <tbody>
                    {matrixRowGroups.map((grp) => {
                      const groupKey = grp.parent.trim() || "—";
                      const open = matrixGroupExpanded.has(groupKey);
                      const groupDetachableKeys = grp.rows.filter((r) => r.user_effect !== "none").map((r) => r.key);
                      const groupAllSelected =
                        groupDetachableKeys.length > 0 && groupDetachableKeys.every((k) => bulkSel.has(k));
                      const groupSomeSelected =
                        groupDetachableKeys.length > 0 &&
                        groupDetachableKeys.some((k) => bulkSel.has(k)) &&
                        !groupAllSelected;
                      return (
                        <Fragment key={grp.parent}>
                          <tr className="border-t border-border/60 bg-muted/35">
                            <td className="access-matrix-col-select py-1 align-middle">
                              <div className="flex items-center justify-center px-0.5">
                                <IndeterminateCheckbox
                                  checked={groupAllSelected}
                                  indeterminate={groupSomeSelected}
                                  disabled={patchMut.isPending || groupDetachableKeys.length === 0}
                                  className="h-3.5 w-3.5"
                                  title={
                                    groupDetachableKeys.length === 0
                                      ? "В группе нет строк с пользовательской настройкой (только из роли)"
                                      : groupAllSelected
                                        ? "Снять выбор со всех строк группы"
                                        : "Выбрать все строки группы с пользовательской настройкой"
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
                              colSpan={5}
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
                            ? grp.rows.map((row) => (
                                <tr key={row.key} className="border-t border-border/50 transition-colors hover:bg-muted/25">
                                  <td className="access-matrix-col-select py-2">
                                    <input
                                      type="checkbox"
                                      className={`h-4 w-4 ${row.user_effect !== "none" ? "accent-teal-700" : "cursor-not-allowed opacity-45"}`}
                                      checked={row.user_effect !== "none" ? bulkSel.has(row.key) : false}
                                      disabled={patchMut.isPending || row.user_effect === "none"}
                                      title={row.user_effect !== "none" ? undefined : "Только из роли — открепление через таблицу недоступно"}
                                      aria-label={
                                        row.user_effect !== "none"
                                          ? `Выбрать строку: ${displayAccessDescriptionShort(row.description, row.key)}`
                                          : `Только из роли, массовое выделение недоступно: ${displayAccessDescriptionShort(row.description, row.key)}`
                                      }
                                      onChange={(e) => {
                                        if (row.user_effect === "none") return;
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
                                  <td className="w-[10rem] px-2 py-2 text-center align-middle">
                                    <label className="relative mx-auto flex h-6 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                                      <input
                                        type="checkbox"
                                        role="switch"
                                        aria-checked={row.effective}
                                        aria-label={`${row.effective ? "Разрешено" : "Запрещено"}: ${displayAccessDescriptionShort(row.description, row.key)}`}
                                        className="peer sr-only"
                                        checked={row.effective}
                                        disabled={
                                          patchMut.isPending ||
                                          (!canUsePredostRow(row) && !row.effective)
                                        }
                                        title={
                                          !canUsePredostRow(row) && !row.effective
                                            ? "Включите «Доступ: управление» (access.manage), чтобы выдавать эту операцию."
                                            : "Выдача операции пользователю (и далее — другим через «Доступ» при наличии access.manage)"
                                        }
                                        onChange={(e) => void toggleRow(row, e.target.checked)}
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
                                  <td className="w-[8.5rem] px-2 py-2 text-center align-middle">
                                    {row.user_effect !== "none" ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 min-w-[6.5rem] border-teal-600/45 px-2 text-[11px] text-teal-950 hover:bg-teal-500/10 dark:text-emerald-100"
                                        disabled={patchMut.isPending}
                                        onClick={() => void patchMut.mutateAsync({ remove_permission_keys: [row.key] })}
                                      >
                                        Открепить
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {bulkSel.size > 0 ? (
              <AccessBulkBottomBar
                variant="operations"
                selectedCount={bulkSel.size}
                totalVisibleCount={detachableKeys.length}
                onClear={() => setBulkSel(new Set())}
                busy={patchMut.isPending}
                denyTitle="Запретить выбранные операции (снять эффект)"
                onDeny={() => void bulkApplyFilteredEffective(false)}
                onDetach={() => void bulkDetach()}
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
                  <p className="py-8 text-center text-xs text-muted-foreground">Ничего не найдено</p>
                ) : (
                  opAttachGroups.map((grp) => {
                  const expanded = opAttachGroupExpanded.has(grp.parent);
                  return (
                    <div key={grp.parent} className="border-b border-border/40 py-1 last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-xs font-semibold hover:bg-muted/50"
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
                      {expanded ? (
                        <div className="mt-0.5 space-y-0 border-l border-border/45 pl-2">
                          {grp.items.map((item) => {
                            const rowM = matrixByKey.get(item.key);
                            const rowEff = rowM?.effective ?? false;
                            const lockAddOps =
                              !targetHasAccessManage && item.key !== ACCESS_MANAGE_KEY && !rowEff;
                            return (
                              <label
                                key={item.key}
                                className={`flex cursor-pointer items-start gap-2 border-b border-border/30 py-1.5 last:border-b-0 ${lockAddOps && !modalSel.has(item.key) ? "cursor-not-allowed opacity-60" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 accent-teal-700"
                                  disabled={patchMut.isPending || (lockAddOps && !modalSel.has(item.key))}
                                  checked={modalSel.has(item.key)}
                                  title={
                                    lockAddOps && !modalSel.has(item.key)
                                      ? "Сначала включите «Доступ: управление» (access.manage)."
                                      : undefined
                                  }
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
                            );
                          })}
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
