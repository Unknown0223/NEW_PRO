import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { TENANT_ADMIN_ROLE, TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION } from "../../lib/tenant-user-roles";
import { isGrantDelegationKey, isMatrixOperationKey, toGrantDelegationKey } from "./access-grant-delegation";
import { derivePermissionModule } from "./rbac.resolve";
import { assertCanGrantAccessManage, withAutoAccessModuleViewForManage } from "./rbac.access-manage";

/** Rolga `access.grant.*` biriktirilmasin — faqat shaxsiy user_permissions. */
function roleAssignablePermissionKeys(keys: string[]): string[] {
  return [
    ...new Set(
      keys
        .map((k) => k.trim())
        .filter((k) => k.length > 0 && !isGrantDelegationKey(k) && isMatrixOperationKey(k))
    )
  ];
}

/** Deny qilingan operatsiya uchun shaxsiy grant-allow ham olib tashlanadi. */
function grantDelegationKeysForOps(opKeys: string[]): string[] {
  return [
    ...new Set(
      opKeys
        .map((k) => k.trim())
        .filter((k) => k.length > 0 && !isGrantDelegationKey(k) && isMatrixOperationKey(k))
        .map((k) => toGrantDelegationKey(k))
    )
  ];
}

export async function removeUserPermissionsByKeys(tx: Prisma.TransactionClient, tenantId: number, userId: number, keys: string[]) {
  const uniq = [
    ...new Set([...keys.map((k) => k.trim()).filter(Boolean), ...grantDelegationKeysForOps(keys)])
  ];
  if (uniq.length === 0) return;
  const perms = await tx.permission.findMany({
    where: { tenant_id: tenantId, key: { in: uniq } },
    select: { id: true }
  });
  if (perms.length === 0) return;
  await tx.userPermission.deleteMany({
    where: { user_id: userId, permission_id: { in: perms.map((p) => p.id) } }
  });
}

/** Bir `tx` ichida — bulk uchun barcha kalitlar uchun `Permission.id` (kam `upsert`). */
export async function ensurePermissionIdsForKeys(
  tx: Prisma.TransactionClient,
  tenantId: number,
  keys: string[]
): Promise<Map<string, number>> {
  const uniq = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  const out = new Map<string, number>();
  if (uniq.length === 0) return out;
  const found = await tx.permission.findMany({
    where: { tenant_id: tenantId, key: { in: uniq } },
    select: { id: true, key: true }
  });
  for (const p of found) out.set(p.key, p.id);
  const missing = uniq.filter((k) => !out.has(k));
  if (missing.length > 0) {
    const upsertResults = await Promise.all(
      missing.map(async (key) => {
        const p = await tx.permission.upsert({
          where: { tenant_id_key: { tenant_id: tenantId, key } },
          create: { tenant_id: tenantId, key, module: derivePermissionModule(key) },
          update: {}
        });
        out.set(key, p.id);
        return p.id;
      })
    );
  }
  return out;
}

/** Bir xil allow/deny — ko‘p foydalanuvchi: kalit bo‘yicha 2 ta so‘rov (o‘chirish + qo‘shish). */
export async function bulkMergeUserPermissionKeysForUsers(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userIds: number[],
  allow: string[],
  deny: string[],
  permissionIdByKey: ReadonlyMap<string, number>
): Promise<void> {
  if (userIds.length === 0) return;
  const allowU = withAutoAccessModuleViewForManage(allow);
  const denyU = [...new Set(deny.map((k) => k.trim()).filter(Boolean))];
  if (allowU.includes("access.manage")) {
    for (const userId of userIds) {
      const row = await tx.user.findFirst({ where: { id: userId, tenant_id: tenantId }, select: { role: true } });
      await assertCanGrantAccessManage(tenantId, userId, row?.role ?? null, allowU);
    }
  }
  for (const key of allowU) {
    const pid = permissionIdByKey.get(key);
    if (pid == null) throw new Error(`bulkMerge: missing permission id for key ${key}`);
    await tx.userPermission.deleteMany({ where: { user_id: { in: userIds }, permission_id: pid } });
    await tx.userPermission.createMany({
      data: userIds.map((user_id) => ({ user_id, permission_id: pid, effect: "allow" as const })),
      skipDuplicates: true
    });
  }
  for (const key of denyU) {
    const pid = permissionIdByKey.get(key);
    if (pid == null) throw new Error(`bulkMerge: missing permission id for key ${key}`);
    await tx.userPermission.deleteMany({ where: { user_id: { in: userIds }, permission_id: pid } });
    await tx.userPermission.createMany({
      data: userIds.map((user_id) => ({ user_id, permission_id: pid, effect: "deny" as const })),
      skipDuplicates: true
    });
  }
  const grantRevoke = grantDelegationKeysForOps(denyU);
  if (grantRevoke.length > 0) {
    await bulkRemoveUserPermissionsByKeysForUsers(tx, tenantId, userIds, grantRevoke);
  }
}

export async function bulkRemoveUserPermissionsByKeysForUsers(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userIds: number[],
  keys: string[]
): Promise<void> {
  const uniq = [
    ...new Set([...keys.map((k) => k.trim()).filter(Boolean), ...grantDelegationKeysForOps(keys)])
  ];
  if (uniq.length === 0 || userIds.length === 0) return;
  const perms = await tx.permission.findMany({
    where: { tenant_id: tenantId, key: { in: uniq } },
    select: { id: true }
  });
  if (perms.length === 0) return;
  await tx.userPermission.deleteMany({
    where: { user_id: { in: userIds }, permission_id: { in: perms.map((p) => p.id) } }
  });
}

/** Foydalanuvchiga qo‘shimcha allow/deny — target `access.manage` talab qilinmaydi (admin «Доступ» orqali). */
export async function mergeUserPermissionKeys(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number,
  allow: string[],
  deny: string[],
  permissionIdByKey?: ReadonlyMap<string, number>,
  rbacRoleHint?: string | null
) {
  const allowU = withAutoAccessModuleViewForManage(allow);
  const denyU = [...new Set(deny.map((k) => k.trim()).filter(Boolean))];
  if (allowU.includes("access.manage")) {
    await assertCanGrantAccessManage(tenantId, userId, rbacRoleHint ?? null, allowU);
  }

  const allKeys = [...new Set([...allowU, ...denyU])];
  if (allKeys.length === 0) return;

  const idByKey = new Map<string, number>();
  if (permissionIdByKey) {
    for (const key of allKeys) {
      const id = permissionIdByKey.get(key);
      if (id != null) idByKey.set(key, id);
    }
  }
  const missing = allKeys.filter((k) => !idByKey.has(k));
  if (missing.length > 0) {
    const ensured = await ensurePermissionIdsForKeys(tx, tenantId, missing);
    for (const [k, id] of ensured) idByKey.set(k, id);
  }

  if (allowU.length > 0) {
    const allowPids = allowU.map((k) => idByKey.get(k)).filter((id): id is number => id != null);
    if (allowPids.length > 0) {
      await tx.userPermission.deleteMany({ where: { user_id: userId, permission_id: { in: allowPids } } });
      await tx.userPermission.createMany({
        data: allowPids.map((permission_id) => ({ user_id: userId, permission_id, effect: "allow" as const })),
        skipDuplicates: true
      });
    }
  }
  if (denyU.length > 0) {
    const denyPids = denyU.map((k) => idByKey.get(k)).filter((id): id is number => id != null);
    if (denyPids.length > 0) {
      await tx.userPermission.deleteMany({ where: { user_id: userId, permission_id: { in: denyPids } } });
      await tx.userPermission.createMany({
        data: denyPids.map((permission_id) => ({ user_id: userId, permission_id, effect: "deny" as const })),
        skipDuplicates: true
      });
    }
    await removeUserPermissionsByKeys(tx, tenantId, userId, grantDelegationKeysForOps(denyU));
  }
}

export async function setRolePermissions(tenantId: number, roleId: number, permissionKeys: string[]) {
  const keys = roleAssignablePermissionKeys(permissionKeys);
  const permissions = [];
  const chunkSize = 8;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    const batch = await Promise.all(
      chunk.map((key) =>
        prisma.permission.upsert({
          where: { tenant_id_key: { tenant_id: tenantId, key } },
          create: { tenant_id: tenantId, key, module: derivePermissionModule(key) },
          update: {}
        })
      )
    );
    permissions.push(...batch);
  }
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role_id: roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ role_id: roleId, permission_id: p.id })),
      skipDuplicates: true
    })
  ]);
}

/**
 * Rolga noto‘g‘ri biriktirilgan `access.grant.*` havolalarini olib tashlaydi
 * (grant faqat shaxsiy user_permissions bo‘lishi kerak).
 */
export async function stripGrantDelegationKeysFromRoles(tenantId: number): Promise<number> {
  const grantPerms = await prisma.permission.findMany({
    where: { tenant_id: tenantId, key: { startsWith: "access.grant." } },
    select: { id: true }
  });
  if (grantPerms.length === 0) return 0;
  const result = await prisma.rolePermission.deleteMany({
    where: { permission_id: { in: grantPerms.map((p) => p.id) }, role: { tenant_id: tenantId } }
  });
  return result.count;
}
