import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { TENANT_ADMIN_ROLE, TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION } from "../../lib/tenant-user-roles";
import {
  ACCESS_MANAGE_PERMISSION_KEY,
  AccessManageRequiredError,
  getUsersHaveAccessManage
} from "./rbac.access-manage";
import { derivePermissionModule } from "./rbac.resolve";

export async function removeUserPermissionsByKeys(tx: Prisma.TransactionClient, tenantId: number, userId: number, keys: string[]) {
  const uniq = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
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
  await Promise.all(
    missing.map(async (key) => {
      const p = await tx.permission.upsert({
        where: { tenant_id_key: { tenant_id: tenantId, key } },
        create: { tenant_id: tenantId, key, module: derivePermissionModule(key) },
        update: {}
      });
      out.set(key, p.id);
    })
  );
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
  const allowU = [...new Set(allow.map((k) => k.trim()).filter(Boolean))];
  const needsManageGate =
    allowU.some((k) => k !== ACCESS_MANAGE_PERMISSION_KEY) && !allowU.includes(ACCESS_MANAGE_PERMISSION_KEY);
  if (needsManageGate) {
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: userIds } },
      select: { id: true, role: true }
    });
    const withManage = await getUsersHaveAccessManage(
      tenantId,
      users.map((u) => ({ id: u.id, role: u.role }))
    );
    for (const uid of userIds) {
      if (!withManage.has(uid)) throw new AccessManageRequiredError();
    }
  }
  const denyU = [...new Set(deny.map((k) => k.trim()).filter(Boolean))];
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
}

export async function bulkRemoveUserPermissionsByKeysForUsers(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userIds: number[],
  keys: string[]
): Promise<void> {
  const uniq = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
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

export async function mergeUserPermissionKeys(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number,
  allow: string[],
  deny: string[],
  permissionIdByKey?: ReadonlyMap<string, number>,
  rbacRoleHint?: string | null
) {
  const allowU = [...new Set(allow.map((k) => k.trim()).filter(Boolean))];
  const denyU = [...new Set(deny.map((k) => k.trim()).filter(Boolean))];
  const needsManageGate =
    allowU.some((k) => k !== ACCESS_MANAGE_PERMISSION_KEY) && !allowU.includes(ACCESS_MANAGE_PERMISSION_KEY);
  if (needsManageGate) {
    const role =
      rbacRoleHint ??
      (
        await tx.user.findUnique({
          where: { id: userId },
          select: { role: true }
        })
      )?.role ??
      null;
    const withManage = await getUsersHaveAccessManage(tenantId, [{ id: userId, role }]);
    if (!withManage.has(userId)) throw new AccessManageRequiredError();
  }
  const applyOne = async (key: string, effect: "allow" | "deny") => {
    let pid = permissionIdByKey?.get(key);
    if (pid == null) {
      const p = await tx.permission.upsert({
        where: { tenant_id_key: { tenant_id: tenantId, key } },
        create: { tenant_id: tenantId, key, module: derivePermissionModule(key) },
        update: {}
      });
      pid = p.id;
    }
    await tx.userPermission.deleteMany({ where: { user_id: userId, permission_id: pid } });
    await tx.userPermission.create({ data: { user_id: userId, permission_id: pid, effect } });
  };
  await Promise.all(allowU.map((key) => applyOne(key, "allow")));
  await Promise.all(denyU.map((key) => applyOne(key, "deny")));
}

export async function setRolePermissions(tenantId: number, roleId: number, permissionKeys: string[]) {
  const keys = [...new Set(permissionKeys.map((k) => k.trim()).filter(Boolean))];
  const permissions = await Promise.all(
    keys.map((key) =>
      prisma.permission.upsert({
        where: { tenant_id_key: { tenant_id: tenantId, key } },
        create: { tenant_id: tenantId, key, module: derivePermissionModule(key) },
        update: {}
      })
    )
  );
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role_id: roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ role_id: roleId, permission_id: p.id })),
      skipDuplicates: true
    })
  ]);
}
