import type { AxiosError } from "axios";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { formatPersonDisplayName } from "@/lib/person-display";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { cityStoredCodeToDisplayLabel, looksLikeTerritoryStoredCode } from "@/lib/city-territory-hint";
import type { TableSortDir } from "@/components/ui/table-sort-button";

export type MatrixRow = {
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

export function userMessageAfterAccessPatchFailure(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
  if (flat) {
    const hint = firstValidationUserHint(flat);
    return withApiSupportLine(hint ?? "Ma’lumotlarni tekshiring.", err);
  }
  return getUserFacingError(err, fallback);
}

export type MatrixSortKey = "description" | "parent" | "section";

export type ModalPickRow = {
  key: string;
  label: string;
  /** Ikkinchi qator: operatsiyada texnik kalit; kassa/ombor da son. */
  sub: string;
  /** Operatsiya modalida guruhlash (parent_path); bo‘lmasa `sub` ishlatiladi. */
  groupKey?: string;
};

export const matrixCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

export function compareMatrixRows(a: MatrixRow, b: MatrixRow, key: MatrixSortKey, dir: TableSortDir): number {
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

export type DetailResponse = {
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

export type DimRow = { key: string; label: string; attached_users_count: number; is_active: boolean };

/** Ответ GET /access/territories — плоский список. */
export type TerritoryApiRow = {
  id: number;
  key: string;
  label: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

/** GET /access/users?mode=supervisor_pick */
export type SupervisorPickRow = {
  id: number;
  full_name: string;
  code: string | null;
  role: string;
  is_active: boolean;
  supervisor_user_id: number | null;
  branch: string | null;
};

export const STAFF_ROLE_ORDER = ["admin", "supervisor", "agent", "expeditor", "manager"];

export function staffRoleGroupLabel(role: string): string {
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

export function uniqRoleKeys(roles: string[]): string[] {
  return [...new Set(roles)];
}

export function sortStaffRoleKeys(roles: string[]): string[] {
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

export function formatStaffPickLine(u: SupervisorPickRow): string {
  const name = formatPersonDisplayName({ fio: u.full_name, name: u.full_name });
  return name || `#${u.id}`;
}

/** Дерево из `tenant.settings.references.territory_nodes` (как на странице Territoriya). */
export type AccessTerritoryTreeNode = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  children: AccessTerritoryTreeNode[];
};

export type AccessTerritoriesCatalog = {
  flat: TerritoryApiRow[];
  tree: AccessTerritoryTreeNode[];
};

export function collectSubtreeTerritoryIdStrings(n: AccessTerritoryTreeNode): string[] {
  const k = String(n.id);
  const ch = n.children ?? [];
  if (ch.length === 0) return [k];
  return [k, ...ch.flatMap(collectSubtreeTerritoryIdStrings)];
}

export function flattenTerritoryTreeIdStrings(nodes: AccessTerritoryTreeNode[]): string[] {
  return nodes.flatMap(collectSubtreeTerritoryIdStrings);
}

export function territoryTreeNodeDisplayName(node: AccessTerritoryTreeNode): string {
  const name = (node.name ?? "").trim();
  const code = (node.code ?? "").trim();
  if (name && !looksLikeTerritoryStoredCode(name)) return name;
  return cityStoredCodeToDisplayLabel(code || name, name || undefined);
}

export function sortedTerritoryTreeLevel(nodes: AccessTerritoryTreeNode[]): AccessTerritoryTreeNode[] {
  return [...nodes].sort((a, b) =>
    territoryTreeNodeDisplayName(a).localeCompare(territoryTreeNodeDisplayName(b), "ru", {
      sensitivity: "base",
      numeric: true
    })
  );
}

/** Макрозона: FV-…, а также SOUTH-WEST-… (первые два сегмента кода). */
export function territoryGroupKey(code: string | null | undefined): string {
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
export function territorySubgroupKey(code: string | null | undefined, groupKey: string): string {
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
export function humanizeHierarchyLabel(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/_/g, " ")
    .replace(/-/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

export function territoryZoneLabel(groupKey: string): string {
  if (groupKey === "Прочее") return "Прочее";
  return humanizeHierarchyLabel(groupKey);
}

export type TerritorySubgroupNode = {
  key: string;
  label: string;
  items: TerritoryApiRow[];
};

export type TerritoryGroupNode = {
  group: string;
  subgroups: TerritorySubgroupNode[];
};

export function buildTerritoryGroups(rows: TerritoryApiRow[]): { group: string; items: TerritoryApiRow[] }[] {
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
    pair[1].sort((a: TerritoryApiRow, b: TerritoryApiRow) =>
      territoryLeafNameOnly(a).localeCompare(territoryLeafNameOnly(b), "ru", {
        sensitivity: "base",
        numeric: true
      })
    );
  }
  return entries
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([group, items]) => ({ group, items }));
}

export function buildTerritoryHierarchy(rows: TerritoryApiRow[]): TerritoryGroupNode[] {
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
      its.sort((a, b) =>
        territoryLeafNameOnly(a).localeCompare(territoryLeafNameOnly(b), "ru", {
          sensitivity: "base",
          numeric: true
        })
      );
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

/** Только название города/узла; код (`AD_ASAKA` / `AD ASAKA`) UI da ko‘rinmaydi. */
export function territoryLeafNameOnly(r: TerritoryApiRow): string {
  const name = (r.name ?? "").trim();
  const lb = (r.label ?? "").trim();
  const code = (r.code ?? "").trim();

  if (name && !looksLikeTerritoryStoredCode(name)) return name;

  if (lb) {
    const withoutParen = lb.lastIndexOf("(") > 0 ? lb.slice(0, lb.lastIndexOf("(")).trim() : lb;
    if (withoutParen && !looksLikeTerritoryStoredCode(withoutParen)) return withoutParen;
  }

  return cityStoredCodeToDisplayLabel(code || name || lb, name || lb || undefined);
}

export function formatTerritoryAssigneeSubtitle(u: DetailResponse["user"]): string {
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


export function patchTouchesUserDirectory(body: Record<string, unknown>): boolean {
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

export type InnerTab =
  | "territories"
  | "staff"
  | "operations"
  | "cash_desks"
  | "warehouses"
  | "branches"
  | "payment_methods"
  | "trade_directions";

/** Длинные parent_path в option раздувают нативный select — короткая подпись, полный путь в title. */
export function shortenPathLabel(path: string, max = 40): string {
  const t = path.trim();
  if (t.length <= max) return t;
  const head = Math.max(8, Math.floor(max * 0.55));
  const tail = max - head - 1;
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

/** Один PATCH для массового включения/выключения эффективного доступа по списку строк (как toggleRow по каждой). */
export function buildBulkEffectivePatchBody(rows: MatrixRow[], wantEffective: boolean): Record<string, unknown> | null {
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
      /** Роль → deny; только личный allow → remove (иначе remove поверх роли снова откроет доступ). */
      if (row.from_role) denied_permissions.push(row.key);
      else if (row.user_effect === "allow") remove_permission_keys.push(row.key);
      else denied_permissions.push(row.key);
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
  onReset: (userId: number) => void | Promise<void>;
  togglePending: boolean;
  resetPending: boolean;
};
