import type { SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import type { TableSortDir } from "@/components/ui/table-sort-button";
import { localizeAccessSegment } from "@/lib/access-display";

export function formatAccessFilterTriggerSummary<T extends string | number>(
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

export const OP_GRANT_FILTER_ITEMS: SearchableMultiSelectItem<string>[] = [
  { id: "allowed", title: "Может выдавать" },
  { id: "denied", title: "Не может выдавать" }
];

export const OP_ACTIVITY_FILTER_ITEMS: SearchableMultiSelectItem<string>[] = [{ id: "active", title: "Активные" }];

/** Qanchadan ko‘p variant bo‘lsa, ochilganda qidiruv ko‘rinadi. */
export const ACCESS_FILTER_MULTI_SEARCH_MIN = 8;

export const ACCESS_MODAL_ROLE_ORDER = ["admin", "supervisor", "agent", "expeditor", "operator", "manager"];

export function accessModalRoleGroupLabel(role: string): string {
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

export function sortAccessModalRoleKeys(roles: string[]): string[] {
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
export const ACCESS_DIM_TABLE_ROW_ESTIMATE_PX = 46;
export type AccessUserRow = {
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
    trade_directions?: number[];
  };
};

export type DimensionUserRow = {
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
  /** «Доступ: управление» — boshqa operatsiyalar / omborni boshqalarga biriktirish (faqat modul view bilan). */
  has_access_manage?: boolean;
  /** «Доступ» bo‘limini ko‘rish — `access.upravlenie.view`. */
  has_access_module_view?: boolean;
  /** Faqat `dimensions/users` + `warehouses`: `manager` — boshqalarga biriktirish; `operator` — faqat o‘zi. */
  warehouse_link_role?: string | null;
};

export const ACCESS_MANAGE_KEY = "access.manage";
export const ACCESS_MODULE_VIEW_KEY = "access.upravlenie.view";

/** Foydalanuvchi ma’lum operatsiyani boshqalarga berishi — faqat shaxsiy override. */
export const ACCESS_GRANT_DELEGATION_PREFIX = "access.grant.";

export function toGrantDelegationKey(operationKey: string): string {
  let op = operationKey.trim();
  while (op.startsWith(ACCESS_GRANT_DELEGATION_PREFIX)) {
    op = op.slice(ACCESS_GRANT_DELEGATION_PREFIX.length).trim();
  }
  if (!op) return ACCESS_GRANT_DELEGATION_PREFIX.slice(0, -1);
  return `${ACCESS_GRANT_DELEGATION_PREFIX}${op}`;
}

export type GrantDelegationRowLike = { key: string; can_grant_others?: boolean };

export function grantDelegationKeysNeedingChange(rows: GrantDelegationRowLike[], wantGrant: boolean): string[] {
  return [
    ...new Set(
      rows
        .filter((r) => Boolean(r.can_grant_others) !== wantGrant)
        .map((r) => {
          let k = r.key.trim();
          while (k.startsWith(ACCESS_GRANT_DELEGATION_PREFIX)) {
            k = k.slice(ACCESS_GRANT_DELEGATION_PREFIX.length).trim();
          }
          return k;
        })
        .filter((k) => k.length > 0 && !k.includes(ACCESS_GRANT_DELEGATION_PREFIX))
    )
  ];
}

function normalizeOpKeyForGrant(key: string): string {
  let k = key.trim();
  while (k.startsWith(ACCESS_GRANT_DELEGATION_PREFIX)) {
    k = k.slice(ACCESS_GRANT_DELEGATION_PREFIX.length).trim();
  }
  return k;
}

export const GRANT_DELEGATION_PATCH_CHUNK = 80;

export function buildGrantDelegationPatchBody(
  rows: GrantDelegationRowLike[],
  wantGrant: boolean
): Record<string, unknown> | null {
  const keys = grantDelegationKeysNeedingChange(rows, wantGrant);
  if (!keys.length) return null;
  if (wantGrant) return { grant_delegation_allow: keys };
  return { grant_delegation_revoke: keys };
}

export function chunkGrantDelegationPatchBodies(
  rows: GrantDelegationRowLike[],
  wantGrant: boolean,
  chunkSize = GRANT_DELEGATION_PATCH_CHUNK
): Record<string, unknown>[] {
  const keys = grantDelegationKeysNeedingChange(rows, wantGrant);
  const bodies: Record<string, unknown>[] = [];
  for (let i = 0; i < keys.length; i += chunkSize) {
    const slice = keys.slice(i, i + chunkSize);
    if (!slice.length) continue;
    if (wantGrant) bodies.push({ grant_delegation_allow: slice });
    else bodies.push({ grant_delegation_revoke: slice });
  }
  return bodies;
}

export function parseGrantDelegationPatch(body: Record<string, unknown>): null | {
  allowKeys: string[];
  revokeKeys: string[];
} {
  const allow = body.grant_delegation_allow;
  const revoke = body.grant_delegation_revoke;
  const allowKeys = Array.isArray(allow) ? allow.map((k) => String(k).trim()).filter(Boolean) : [];
  const revokeKeys = Array.isArray(revoke) ? revoke.map((k) => String(k).trim()).filter(Boolean) : [];
  if (!allowKeys.length && !revokeKeys.length) return null;
  return { allowKeys, revokeKeys };
}

export type GrantDelegationDetailCache = {
  matrix: Array<{ key: string; can_grant_others?: boolean }>;
  grant_delegation_operation_keys?: string[];
};

/** React Query cache: grant toggles + ro‘yxat sinxron. */
export function applyGrantDelegationDetailCache<T extends GrantDelegationDetailCache>(
  old: T | undefined,
  allowKeys: string[],
  revokeKeys: string[]
): T | undefined {
  if (!old) return old;
  const grantSet = new Set((old.grant_delegation_operation_keys ?? []).map(normalizeOpKeyForGrant));
  for (const k of allowKeys) grantSet.add(normalizeOpKeyForGrant(k));
  for (const k of revokeKeys) grantSet.delete(normalizeOpKeyForGrant(k));
  const allowSet = new Set(allowKeys.map(normalizeOpKeyForGrant));
  const revokeSet = new Set(revokeKeys.map(normalizeOpKeyForGrant));
  return {
    ...old,
    grant_delegation_operation_keys: [...grantSet],
    matrix: old.matrix
      .filter((row) => !row.key.includes(`${ACCESS_GRANT_DELEGATION_PREFIX}${ACCESS_GRANT_DELEGATION_PREFIX}`))
      .map((row) => {
        const op = normalizeOpKeyForGrant(row.key);
        return {
          ...row,
          key: op,
          can_grant_others: allowSet.has(op) ? true : revokeSet.has(op) ? false : grantSet.has(op)
        };
      })
  };
}

/** `access.manage` tanlansa, modul view ham batchga qo‘shiladi (403 oldini olish). */
export function normalizeAccessGrantPermissions(keys: string[]): string[] {
  return withAutoAccessModuleViewForManage(keys);
}

function withAutoAccessModuleViewForManage(allow: string[]): string[] {
  const allowU = [...new Set(allow.map((k) => k.trim()).filter(Boolean))];
  if (allowU.includes(ACCESS_MANAGE_KEY) && !allowU.includes(ACCESS_MODULE_VIEW_KEY)) {
    allowU.unshift(ACCESS_MODULE_VIEW_KEY);
  }
  return allowU;
}

export function applyOptimisticAccessManagePatch(
  row: DimensionUserRow,
  body: Record<string, unknown>
): DimensionUserRow {
  const rm = (body.remove_permission_keys as string[] | undefined) ?? [];
  if (rm.includes(ACCESS_MANAGE_KEY)) {
    return { ...row, has_access_manage: false };
  }
  const den = (body.denied_permissions as string[] | undefined) ?? [];
  if (body.merge_permissions === true && den.includes(ACCESS_MANAGE_KEY)) {
    return { ...row, has_access_manage: false };
  }
  const perms = (body.permissions as string[] | undefined) ?? [];
  if (body.merge_permissions === true && perms.includes(ACCESS_MANAGE_KEY)) {
    return { ...row, has_access_manage: true };
  }
  return row;
}

/** PATCH kutilganda dimension-users keshini bitta qator uchun yangilash. */
export function applyOptimisticOperationDimPatch(
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

export function dimUserDisplayName(u: DimensionUserRow): string {
  return u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login;
}

export type DimUserSortKey = "name" | "role" | "position" | "status";

export function sortDimUserRows(
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

export type SideRow = {
  key: string;
  title: string;
  subtitle: string;
  meta: string;
  idLine: string | null;
  is_active: boolean;
  group: string;
  subgroup: string | null;
};

export function normalizeOperationSegment(value: string): string {
  return localizeAccessSegment(String(value || "").trim().replace(/\s+/g, " "));
}

export function parseOperationLabelParts(
  rawLabel: string,
  fallbackKey: string
): { group: string; subgroup: string | null; title: string } {
  const normalized = String(rawLabel || "").trim();
  if (normalized) {
    const slashParts = normalized.includes(" / ")
      ? normalized
          .split(/\s\/\s/)
          .map((x) => normalizeOperationSegment(x))
          .filter(Boolean)
      : [];
    if (slashParts.length >= 3) {
      const group = slashParts[0] ?? "Общее";
      const subgroupRaw = slashParts[1] ?? "Общее";
      const subgroup = subgroupRaw === group ? null : subgroupRaw;
      // Chap paneldagi sarlavha: «Остатки товаров · Просмотр» (faqat «Просмотр» emas).
      return {
        group,
        subgroup,
        title: slashParts.slice(1).join(" · ")
      };
    }
    if (slashParts.length >= 2) {
      const group = slashParts[0] ?? "Общее";
      const subgroupRaw = slashParts[1] ?? null;
      const subgroup = subgroupRaw && subgroupRaw !== group ? subgroupRaw : null;
      return {
        group,
        subgroup,
        title: slashParts.slice(1).join(" · ")
      };
    }
    const colonParts = normalized
      .split(":")
      .map((x) => normalizeOperationSegment(x))
      .filter(Boolean);
    if (colonParts.length >= 2) {
      return {
        group: colonParts[0] ?? "Общее",
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
      title: keyParts
        .slice(1)
        .map((p) => normalizeOperationSegment(p))
        .join(" · ")
    };
  }
  if (keyParts.length >= 2) {
    const group = normalizeOperationSegment(keyParts[0] ?? "general");
    const subgroupRaw = normalizeOperationSegment(keyParts[1] ?? "");
    const subgroup = subgroupRaw && subgroupRaw !== group ? subgroupRaw : null;
    return {
      group,
      subgroup,
      title: keyParts
        .slice(1)
        .map((p) => normalizeOperationSegment(p))
        .join(" · ")
    };
  }
  const fallback = normalizeOperationSegment(normalized || fallbackKey || "Операция");
  return { group: "Общее", subgroup: null, title: fallback };
}

export type ScopeDimensionTab =
  | "cash_desks"
  | "warehouses"
  | "branches"
  | "payment_methods"
  | "trade_directions";

export function isScopeDimensionTab(tab: string): tab is ScopeDimensionTab {
  return (
    tab === "cash_desks" ||
    tab === "warehouses" ||
    tab === "branches" ||
    tab === "payment_methods" ||
    tab === "trade_directions"
  );
}

export function buildScopeDimensionPatchBody(
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
  if (kind === "trade_directions") {
    const directionId = Number(selectedScopeKey);
    if (!Number.isInteger(directionId) || directionId < 1) return null;
    const current = Array.from(
      new Set((u.scope?.trade_directions ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
    );
    const hasCurrent = current.includes(directionId);
    if (want === hasCurrent) return null;
    return {
      trade_direction_ids: want
        ? Array.from(new Set([...current, directionId]))
        : current.filter((id) => id !== directionId)
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

export function scopeUserHasObjectAttachment(kind: ScopeDimensionTab, selectedScopeKey: string, u: AccessUserRow): boolean {
  return buildScopeDimensionPatchBody(kind, selectedScopeKey, u, false) !== null;
}

export type OpAccessMutCtx = {
  previous: DimensionUserRow[] | null;
  qk: readonly [string, string, string, string | undefined];
};

export type AccessBulkPatchItem = Record<string, unknown> & { user_id: number };
export function collectScopeDimensionModalBulkItems(
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

export function accessWorkspaceUserPickerModalTitle(
  usersModalKind: ScopeDimensionTab | "operations" | "users",
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
    case "trade_directions":
      return `Прикрепить к направлению${suffix}`;
    case "users":
      return `Прикрепить пользователей${suffix}`;
    default:
      return `Прикрепить пользователей${suffix}`;
  }
}

/** Как в модалке супервайзера: имя + код + филиал одной строкой для title, две строки в UI. */
export function accessModalUserPrimaryLine(u: AccessUserRow): string {
  const name = (u.full_name || u.login || "").trim();
  const code = u.code?.trim();
  if (code) return `[${code}] ${name || u.login}`.trim();
  return name || u.login;
}

export function accessModalUserBranchLine(u: AccessUserRow): string | null {
  const b = u.branch?.trim();
  return b ? b : null;
}
