import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { TENANT_ADMIN_ROLE, TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION } from "../../lib/tenant-user-roles";
import { isGrantDelegationKey, isMatrixOperationKey } from "./access-grant-delegation";
import { expandPermissionKeyAliases } from "./legacy-key-map";


export function derivePermissionModule(key: string): string {
  const raw = (key.split(".")[0] ?? "general").trim() || "general";
  return raw.slice(0, 120);
}

/** Rol / me-permissions / operations_count — faqat haqiqiy operatsiyalar (`access.grant.*` emas). */
function addRoleOperationKey(into: Set<string>, key: string): void {
  const k = key.trim();
  if (!k || isGrantDelegationKey(k) || !isMatrixOperationKey(k)) return;
  into.add(k);
}

function stripGrantDelegationKeys(keys: Set<string>): void {
  for (const k of [...keys]) {
    if (isGrantDelegationKey(k) || !isMatrixOperationKey(k)) keys.delete(k);
  }
}

export type RoleWithPermKeys = {
  key: string;
  permissions: { permission: { key: string } }[];
};

/** Faqat kerakli `key` bo‘yicha rollar — butun tenant ro‘yxatini yuklamaslik (tez). */
export async function loadRolesByKeys(tenantId: number, keys: string[]): Promise<Map<string, RoleWithPermKeys>> {
  const uniq = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.role.findMany({
    where: { tenant_id: tenantId, key: { in: uniq } },
    select: { key: true, permissions: { select: { permission: { select: { key: true } } } } }
  });
  return new Map(rows.map((r) => [r.key, r]));
}

/**
 * Bitta foydalanuvchi uchun rol + to‘g‘ridan-texnik ruxsatlar.
 * Avvalgi usul: `tenant_id` bo‘yicha *barcha* rollar (og‘ir) yuklanardi; endi faqat foydalanuvchi
 * `user_roles` va (kerak bo‘lsa) bitta `fallback` profil.
 */
export async function resolveUserPermissionKeysSplit(
  tenantId: number,
  userId: number,
  fallbackRole?: string | null
): Promise<{
  fromRole: Set<string>;
  effective: Set<string>;
  userPerms: { effect: string; key: string }[];
}> {
  const [roleLinks, userPermRows] = await Promise.all([
    prisma.userRole.findMany({
      where: { user_id: userId, role: { tenant_id: tenantId } },
      select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } }
    }),
    prisma.userPermission.findMany({
      where: { user_id: userId, permission: { tenant_id: tenantId } },
      select: { effect: true, permission: { select: { key: true } } }
    })
  ]);

  const userPerms = userPermRows.map((up) => ({ effect: up.effect, key: up.permission.key }));

  const fromRole = new Set<string>();
  if (roleLinks.length > 0) {
    for (const link of roleLinks) {
      for (const row of link.role.permissions) {
        for (const k of expandPermissionKeyAliases([row.permission.key])) {
          addRoleOperationKey(fromRole, k);
        }
      }
    }
  } else if (fallbackRole) {
    const map = await loadRolesByKeys(tenantId, [fallbackRole]);
    const fb = map.get(fallbackRole);
    if (fb) {
      for (const row of fb.permissions) {
        for (const k of expandPermissionKeyAliases([row.permission.key])) {
          addRoleOperationKey(fromRole, k);
        }
      }
    }
  }

  const effective = new Set(fromRole);
  const denied = new Set<string>();
  const allowed = new Set<string>();
  for (const up of userPerms) {
    if (up.effect === "deny") denied.add(up.key);
    // Shaxsiy allow: alias expand (legacy ↔ structured) — deny bilan simmetrik.
    if (up.effect === "allow") allowed.add(up.key);
  }
  for (const k of expandPermissionKeyAliases([...allowed])) addRoleOperationKey(effective, k);
  // Structured deny (Access UI) must also drop legacy dashboard.* keys from effective.
  for (const k of expandPermissionKeyAliases([...denied])) effective.delete(k);
  stripGrantDelegationKeys(effective);
  return { fromRole, effective, userPerms };
}

export async function resolveUserPermissionKeys(
  tenantId: number,
  userId: number,
  fallbackRole?: string | null
): Promise<Set<string>> {
  const { effective } = await resolveUserPermissionKeysSplit(tenantId, userId, fallbackRole);
  return effective;
}

/** Rol profilidagi kalitlar (UserPermission qatlamisiz) — matrix `from_role` uchun */
export async function getRolePermissionKeysOnly(tenantId: number, userId: number, fallbackRole?: string | null): Promise<Set<string>> {
  const { fromRole } = await resolveUserPermissionKeysSplit(tenantId, userId, fallbackRole);
  return fromRole;
}

export async function getUserOperationsCount(tenantId: number, userId: number, fallbackRole?: string | null) {
  const { effective } = await resolveUserPermissionKeysSplit(tenantId, userId, fallbackRole);
  return effective.size;
}

/** Один запрос к ролям + батч к связям — вместо N×`resolveUserPermissionKeys` в списке пользователей. */
export async function getOperationsCountsForUsers(
  tenantId: number,
  rows: { id: number; role: string | null }[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (rows.length === 0) return out;
  const userIds = rows.map((r) => r.id);

  const [userRoleLinks, userPerms] = await Promise.all([
    prisma.userRole.findMany({
      where: { user_id: { in: userIds }, role: { tenant_id: tenantId } },
      select: {
        user_id: true,
        role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } }
      }
    }),
    prisma.userPermission.findMany({
      where: { user_id: { in: userIds }, permission: { tenant_id: tenantId } },
      select: { user_id: true, effect: true, permission: { select: { key: true } } }
    })
  ]);

  const permsByUserId = new Map<number, { effect: string; key: string }[]>();
  for (const up of userPerms) {
    const arr = permsByUserId.get(up.user_id) ?? [];
    arr.push({ effect: up.effect, key: up.permission.key });
    permsByUserId.set(up.user_id, arr);
  }

  const roleLinksByUser = new Map<number, typeof userRoleLinks>();
  for (const link of userRoleLinks) {
    const arr = roleLinksByUser.get(link.user_id) ?? [];
    arr.push(link);
    roleLinksByUser.set(link.user_id, arr);
  }

  const fallbackKeys = new Set<string>();
  for (const { id: userId, role: fr } of rows) {
    if ((roleLinksByUser.get(userId) ?? []).length === 0 && fr) fallbackKeys.add(fr);
  }
  const allRoleByKey = await loadRolesByKeys(tenantId, [...fallbackKeys]);

  for (const { id: userId, role: fallbackRole } of rows) {
    const rolePerms = new Set<string>();
    const links = roleLinksByUser.get(userId) ?? [];
    if (links.length > 0) {
      for (const link of links) {
        for (const row of link.role.permissions) {
          for (const k of expandPermissionKeyAliases([row.permission.key])) {
            addRoleOperationKey(rolePerms, k);
          }
        }
      }
    } else if (fallbackRole && allRoleByKey.has(fallbackRole)) {
      for (const row of allRoleByKey.get(fallbackRole)!.permissions) {
        for (const k of expandPermissionKeyAliases([row.permission.key])) {
          addRoleOperationKey(rolePerms, k);
        }
      }
    }

    const denied = new Set<string>();
    const allowed = new Set<string>();
    for (const up of permsByUserId.get(userId) ?? []) {
      if (up.effect === "deny") denied.add(up.key);
      if (up.effect === "allow") allowed.add(up.key);
    }
    for (const k of expandPermissionKeyAliases([...allowed])) addRoleOperationKey(rolePerms, k);
    for (const k of expandPermissionKeyAliases([...denied])) rolePerms.delete(k);
    stripGrantDelegationKeys(rolePerms);
    out.set(userId, rolePerms.size);
  }
  return out;
}
