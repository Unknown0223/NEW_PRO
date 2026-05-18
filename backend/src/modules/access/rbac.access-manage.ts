import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { TENANT_ADMIN_ROLE, TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION } from "../../lib/tenant-user-roles";

import { loadRolesByKeys, type RoleWithPermKeys } from "./rbac.resolve";

/** «Доступ: управление» — boshqa operatsiyalarni foydalanuvchiga biriktirish / delegatsiya. */
export const ACCESS_MANAGE_PERMISSION_KEY = "access.manage";

export class AccessManageRequiredError extends Error {
  readonly code = "ACCESS_MANAGE_REQUIRED" as const;
  constructor(message = "ACCESS_MANAGE_REQUIRED") {
    super(message);
    this.name = "AccessManageRequiredError";
  }
}

/** Rol katalogi (tenant bo‘yicha) — `getUsersHaveAccessManage` ni bo‘laklashda qayta yuklamaslik uchun. */
export type AccessManageRoleCatalog = Map<
  string,
  { key: string; permissions: { permission: { key: string } }[] }
>;

/** Batched: kimda `access.manage` effektiv (rol + UserPermission). */
export async function getUsersHaveAccessManage(
  tenantId: number,
  rows: { id: number; role: string | null }[],
  roleCatalog?: AccessManageRoleCatalog
): Promise<Set<number>> {
  const out = new Set<number>();
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

  const allRoleByKey: Map<string, RoleWithPermKeys> =
    roleCatalog ??
    (await (async () => {
      const fallbackKeys = new Set<string>();
      for (const { id: userId, role: fr } of rows) {
        if ((roleLinksByUser.get(userId) ?? []).length === 0 && fr) fallbackKeys.add(fr);
      }
      return loadRolesByKeys(tenantId, [...fallbackKeys]);
    })());

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
    const denied = new Set<string>();
    for (const up of permsByUserId.get(userId) ?? []) {
      if (up.effect === "deny") denied.add(up.key);
      if (up.effect === "allow") rolePerms.add(up.key);
    }
    for (const k of denied) rolePerms.delete(k);
    if (rolePerms.has(ACCESS_MANAGE_PERMISSION_KEY)) out.add(userId);
  }
  return out;
}
