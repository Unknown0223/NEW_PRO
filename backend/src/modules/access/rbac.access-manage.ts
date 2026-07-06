import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

import { loadRolesByKeys, type RoleWithPermKeys } from "./rbac.resolve";

/** «Доступ: управление» — boshqa foydalanuvchilarga operatsiya biriktirish. */
export const ACCESS_MANAGE_PERMISSION_KEY = "access.manage";
/** «Доступ» bo‘limini ko‘rish — modul menyuda va API da ochiladi. */
export const ACCESS_MODULE_VIEW_KEY = "access.upravlenie.view";

export class AccessManageRequiredError extends Error {
  readonly code = "ACCESS_MANAGE_REQUIRED" as const;
  constructor(message = "ACCESS_MANAGE_REQUIRED") {
    super(message);
    this.name = "AccessManageRequiredError";
  }
}

export class AccessModuleViewRequiredError extends Error {
  readonly code = "ACCESS_MODULE_VIEW_REQUIRED" as const;
  constructor(message = "ACCESS_MODULE_VIEW_REQUIRED") {
    super(message);
    this.name = "AccessModuleViewRequiredError";
  }
}

/** Rol katalogi (tenant bo‘yicha) — batch hisobda qayta yuklamaslik uchun. */
export type AccessManageRoleCatalog = Map<
  string,
  { key: string; permissions: { permission: { key: string } }[] }
>;

type UserRoleRow = { id: number; role: string | null };

function buildEffectivePermissionSets(
  rows: UserRoleRow[],
  userRoleLinks: Array<{
    user_id: number;
    role: { key: string; permissions: { permission: { key: string } }[] };
  }>,
  userPerms: Array<{ user_id: number; effect: string; permission: { key: string } }>,
  allRoleByKey: Map<string, RoleWithPermKeys>
): Map<number, Set<string>> {
  const roleLinksByUser = new Map<number, typeof userRoleLinks>();
  for (const link of userRoleLinks) {
    const arr = roleLinksByUser.get(link.user_id) ?? [];
    arr.push(link);
    roleLinksByUser.set(link.user_id, arr);
  }

  const permsByUserId = new Map<number, { effect: string; key: string }[]>();
  for (const up of userPerms) {
    const arr = permsByUserId.get(up.user_id) ?? [];
    arr.push({ effect: up.effect, key: up.permission.key });
    permsByUserId.set(up.user_id, arr);
  }

  const out = new Map<number, Set<string>>();
  for (const { id: userId, role: fallbackRole } of rows) {
    const rolePerms = new Set<string>();
    const links = roleLinksByUser.get(userId) ?? [];
    if (links.length > 0) {
      for (const link of links) {
        for (const row of link.role.permissions) rolePerms.add(row.permission.key);
      }
    } else if (fallbackRole && allRoleByKey.has(fallbackRole)) {
      for (const row of allRoleByKey.get(fallbackRole)!.permissions) rolePerms.add(row.permission.key);
    }
    for (const up of permsByUserId.get(userId) ?? []) {
      if (up.effect === "deny") rolePerms.delete(up.key);
      if (up.effect === "allow") rolePerms.add(up.key);
    }
    out.set(userId, rolePerms);
  }
  return out;
}

async function loadEffectivePermissionSets(
  tenantId: number,
  rows: UserRoleRow[],
  roleCatalog?: AccessManageRoleCatalog
): Promise<Map<number, Set<string>>> {
  if (rows.length === 0) return new Map();
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

  const roleLinksByUser = new Map<number, typeof userRoleLinks>();
  for (const link of userRoleLinks) {
    const arr = roleLinksByUser.get(link.user_id) ?? [];
    arr.push(link);
    roleLinksByUser.set(link.user_id, arr);
  }

  const allRoleByKey: Map<string, RoleWithPermKeys> =
    roleCatalog ??
    (await (async () => {
      const fallbackKeys = new Set<string>();
      for (const { id: userId, role: fr } of rows) {
        if ((roleLinksByUser.get(userId) ?? []).length === 0 && fr) fallbackKeys.add(fr);
      }
      return loadRolesByKeys(tenantId, [...fallbackKeys]);
    })());

  return buildEffectivePermissionSets(rows, userRoleLinks, userPerms, allRoleByKey);
}

/** Kimda «Доступ» moduli ko‘rinadi (view). */
export async function getUsersHaveAccessModuleView(
  tenantId: number,
  rows: UserRoleRow[],
  roleCatalog?: AccessManageRoleCatalog
): Promise<Set<number>> {
  const effective = await loadEffectivePermissionSets(tenantId, rows, roleCatalog);
  const out = new Set<number>();
  for (const [userId, keys] of effective) {
    if (keys.has(ACCESS_MODULE_VIEW_KEY)) out.add(userId);
  }
  return out;
}

/**
 * Kimda boshqalarga ruxsat berish huquqi — `access.manage` VA `access.upravlenie.view` birga.
 * Modul ko‘rinmasa, «выдавать другим» ham yoqilmagan hisoblanadi.
 */
export async function getUsersHaveAccessManage(
  tenantId: number,
  rows: UserRoleRow[],
  roleCatalog?: AccessManageRoleCatalog
): Promise<Set<number>> {
  const { canGrant } = await getUsersAccessDelegationFlags(tenantId, rows, roleCatalog);
  return canGrant;
}

/** `access.manage` allow berishdan oldin — foydalanuvchida modul view bo‘lishi shart (yoki shu batchda). */
export async function assertCanGrantAccessManage(
  tenantId: number,
  userId: number,
  role: string | null,
  allowKeys: string[]
): Promise<void> {
  const allowU = [...new Set(allowKeys.map((k) => k.trim()).filter(Boolean))];
  if (!allowU.includes(ACCESS_MANAGE_PERMISSION_KEY)) return;
  if (allowU.includes(ACCESS_MODULE_VIEW_KEY)) return;
  const viewSet = await getUsersHaveAccessModuleView(tenantId, [{ id: userId, role }]);
  if (!viewSet.has(userId)) throw new AccessModuleViewRequiredError();
}

/** `access.manage` bilan birga modul view yo‘q bo‘lsa — avtomatik qo‘shiladi. */
export function withAutoAccessModuleViewForManage(allow: string[]): string[] {
  const allowU = [...new Set(allow.map((k) => k.trim()).filter(Boolean))];
  if (allowU.includes(ACCESS_MANAGE_PERMISSION_KEY) && !allowU.includes(ACCESS_MODULE_VIEW_KEY)) {
    allowU.unshift(ACCESS_MODULE_VIEW_KEY);
  }
  return allowU;
}

export function effectiveHasAccessModuleView(keys: ReadonlySet<string>): boolean {
  return keys.has(ACCESS_MODULE_VIEW_KEY);
}

export function effectiveCanGrantAccessToOthers(keys: ReadonlySet<string>): boolean {
  return keys.has(ACCESS_MANAGE_PERMISSION_KEY) && keys.has(ACCESS_MODULE_VIEW_KEY);
}

/** Bir so‘rovda modul view va «boshqalarga berish» to‘plamlari. */
export async function getUsersAccessDelegationFlags(
  tenantId: number,
  rows: UserRoleRow[],
  roleCatalog?: AccessManageRoleCatalog
): Promise<{ hasModuleView: Set<number>; canGrant: Set<number> }> {
  const effective = await loadEffectivePermissionSets(tenantId, rows, roleCatalog);
  const hasModuleView = new Set<number>();
  const canGrant = new Set<number>();
  for (const [userId, keys] of effective) {
    if (effectiveHasAccessModuleView(keys)) hasModuleView.add(userId);
    if (effectiveCanGrantAccessToOthers(keys)) canGrant.add(userId);
  }
  return { hasModuleView, canGrant };
}
