import { DEFAULT_PERMISSION_METADATA } from "./permission-catalog";
import { LEGACY_PERMISSION_METADATA } from "./legacy-permission-labels";

const PERM_DESC = new Map<string, string>();
for (const [k, v] of Object.entries(DEFAULT_PERMISSION_METADATA)) {
  PERM_DESC.set(k, v.description);
}
for (const [k, v] of Object.entries(LEGACY_PERMISSION_METADATA)) {
  if (!PERM_DESC.has(k)) PERM_DESC.set(k, v.description);
}

export function permissionDescriptionForKey(key: string): string {
  return PERM_DESC.get(key) ?? humanizePermissionKey(key);
}

function humanizePermissionKey(key: string): string {
  const t = key.trim();
  if (!t) return "—";
  return t.replace(/\./g, " · ");
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Как в отчётах: имя или логин; иначе код в скобках. */
export function formatAccessHistoryPersonLine(
  code: string | null | undefined,
  name: string | null | undefined,
  login: string | null | undefined
): string {
  const c = code?.trim();
  const n = (name || "").trim();
  const l = (login || "").trim();
  if (n) return n;
  if (l) return l;
  if (c) return `[${c}]`;
  return "—";
}

export type AccessHistoryLabelInput = {
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_value: unknown;
  new_value: unknown;
};

export function deriveAccessHistoryOperationLabel(row: AccessHistoryLabelInput): string {
  const { entity_type, entity_id, action_type, new_value } = row;
  if (entity_type === "access_bulk" || action_type.includes("permissions.bulk")) {
    return "Массовое изменение доступа";
  }
  const nv = asObj(new_value);
  if (nv) {
    const rm = nv.remove_permission_keys;
    if (Array.isArray(rm) && rm.length > 0) {
      const first = rm.find((x): x is string => typeof x === "string" && Boolean(x.trim()));
      if (first) return permissionDescriptionForKey(first);
    }
    const perms = nv.permissions;
    if (Array.isArray(perms) && perms.length > 0) {
      const first = perms.find((x): x is string => typeof x === "string" && Boolean(x.trim()));
      if (first) return permissionDescriptionForKey(first);
    }
    const denied = nv.denied_permissions;
    if (Array.isArray(denied) && denied.length > 0) {
      const first = denied.find((x): x is string => typeof x === "string" && Boolean(x.trim()));
      if (first) return permissionDescriptionForKey(first);
    }
    const wd = nv.warehouse_delegate;
    if (wd && typeof wd === "object" && !Array.isArray(wd)) {
      const w = wd as Record<string, unknown>;
      const wid = typeof w.warehouse_id === "number" ? w.warehouse_id : null;
      return wid != null ? `Склад · назначение (ID ${wid})` : "Склад · назначение";
    }
    if (nv.branch_codes !== undefined) return "Филиалы пользователя";
    if (nv.warehouse_ids !== undefined) return "Склады пользователя";
    if (nv.cash_desk_ids !== undefined) return "Кассы пользователя";
    if (nv.payment_methods !== undefined) return "Способы оплаты пользователя";
    if (nv.territory_ids !== undefined) return "Территории пользователя";
    if (nv.trade_direction_ids !== undefined) return "Направления пользователя";
    if (nv.supervisee_user_ids !== undefined) return "Подчинённые супервайзера";
  }
  if (entity_type === "user" && entity_id) {
    if (action_type.includes("access.cloned")) return "Копирование доступа";
    return "Пользователь · доступ";
  }
  return `${entity_type}/${entity_id}`.trim() || "—";
}

export function deriveAccessHistoryActionTypeLabel(row: AccessHistoryLabelInput): string {
  const { action_type, new_value, old_value } = row;
  const nv = asObj(new_value);
  const ov = asObj(old_value);

  if (action_type.includes("permissions.bulk_updated")) {
    const n = nv?.distinct_users;
    const a = nv?.affected;
    const parts: string[] = ["Массовое обновление прав доступа"];
    if (typeof n === "number") parts.push(`пользователей: ${n}`);
    if (typeof a === "number") parts.push(`записей: ${a}`);
    return parts.join(", ");
  }

  if (action_type.includes("access.cloned")) {
    const src = nv?.source_user_id;
    return typeof src === "number"
      ? `Доступ скопирован с пользователя (источник ID ${src})`
      : "Доступ скопирован с другого пользователя";
  }

  if (nv?.warehouse_delegate && typeof nv.warehouse_delegate === "object") {
    const w = nv.warehouse_delegate as Record<string, unknown>;
    const del = w.delegate === true;
    return del
      ? "Возможность предоставления доступа предоставлена"
      : "Возможность предоставления доступа была отозвана";
  }

  if (Array.isArray(nv?.remove_permission_keys) && nv.remove_permission_keys.length > 0) {
    const keys = nv.remove_permission_keys.filter((x): x is string => typeof x === "string");
    const labels = keys.slice(0, 3).map(permissionDescriptionForKey);
    const extra = keys.length > 3 ? ` (+${keys.length - 3})` : "";
    return `Пользовательская настройка снята: ${labels.join("; ")}${extra}`;
  }

  if (nv?.permissions !== undefined || nv?.denied_permissions !== undefined || nv?.merge_permissions !== undefined) {
    const perms = Array.isArray(nv.permissions) ? nv.permissions.filter((x): x is string => typeof x === "string") : [];
    const denied = Array.isArray(nv.denied_permissions)
      ? nv.denied_permissions.filter((x): x is string => typeof x === "string")
      : [];
    if (perms.length > 0 && denied.length === 0) return "Доступ предоставлен";
    if (denied.length > 0 && perms.length === 0) return "Доступ ограничен (запреты)";
    return "Права доступа (операции) обновлены";
  }

  if (
    nv?.branch_codes !== undefined ||
    nv?.warehouse_ids !== undefined ||
    nv?.cash_desk_ids !== undefined ||
    nv?.payment_methods !== undefined ||
    nv?.territory_ids !== undefined
  ) {
    return "Область доступа (касса, склад, филиал и т.п.) изменена";
  }

  if (nv?.supervisee_user_ids !== undefined) {
    return "Состав подчинённых изменён";
  }

  if (action_type.includes("user.profile.updated") || nv?.role !== undefined || nv?.is_active !== undefined) {
    return "Параметры учётной записи изменены";
  }

  if (action_type.includes("permissions.updated")) {
    return "Права доступа изменены";
  }
  if (action_type.includes("scope.updated")) {
    return "Область доступа изменена";
  }
  if (action_type.includes("supervisees.updated")) {
    return "Подчинённые обновлены";
  }

  if (ov && nv && JSON.stringify(ov) !== JSON.stringify(nv)) {
    return `Изменение: ${action_type || "запись"}`;
  }

  return action_type?.trim() ? `Событие: ${action_type}` : "Неизвестно";
}
