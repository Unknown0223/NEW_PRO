import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ensurePermissionIdsForKeys } from "./rbac.permissions";

export type AccessResetPermissionSnap = {
  key: string;
  effect: string;
};

export type AccessResetRoleSnap = {
  role_id: number;
  key: string;
};

/** Snapshot stored in AccessLog.old_value on `access.reset`. */
export type AccessResetSnapshot = {
  role_key: string;
  permissions: AccessResetPermissionSnap[];
  roles: AccessResetRoleSnap[];
};

export function isAccessResetSnapshot(v: unknown): v is AccessResetSnapshot {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.role_key !== "string") return false;
  if (!Array.isArray(o.permissions) || !Array.isArray(o.roles)) return false;
  return true;
}

export async function snapshotUserAccessGrants(
  tenantId: number,
  userId: number,
  roleKey: string
): Promise<AccessResetSnapshot> {
  const [permRows, roleRows] = await Promise.all([
    prisma.userPermission.findMany({
      where: { user_id: userId },
      select: { effect: true, permission: { select: { key: true } } }
    }),
    prisma.userRole.findMany({
      where: { user_id: userId },
      select: { role_id: true, role: { select: { key: true, tenant_id: true } } }
    })
  ]);

  return {
    role_key: roleKey,
    permissions: permRows.map((p) => ({
      key: p.permission.key,
      effect: p.effect === "deny" ? "deny" : "allow"
    })),
    roles: roleRows
      .filter((r) => r.role.tenant_id === tenantId)
      .map((r) => ({ role_id: r.role_id, key: r.role.key }))
  };
}

export async function applyAccessResetToRoleDefault(
  tenantId: number,
  userId: number,
  roleKey: string
): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { tenant_id_key: { tenant_id: tenantId, key: roleKey } }
  });
  await prisma.userPermission.deleteMany({ where: { user_id: userId } });
  await prisma.userRole.deleteMany({ where: { user_id: userId } });
  if (role) {
    await prisma.userRole.create({ data: { user_id: userId, role_id: role.id } });
  }
}

export async function restoreAccessFromResetSnapshot(
  tenantId: number,
  userId: number,
  snapshot: AccessResetSnapshot
): Promise<{ restored_permissions: number; restored_roles: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { user_id: userId } });
    await tx.userRole.deleteMany({ where: { user_id: userId } });

    const roleKeys = [
      ...new Set(
        [snapshot.role_key, ...snapshot.roles.map((r) => r.key)].map((k) => k.trim()).filter(Boolean)
      )
    ];
    const rolesFound = roleKeys.length
      ? await tx.role.findMany({
          where: { tenant_id: tenantId, key: { in: roleKeys } },
          select: { id: true, key: true }
        })
      : [];
    const roleIdByKey = new Map(rolesFound.map((r) => [r.key, r.id]));

    const roleIds = new Set<number>();
    for (const r of snapshot.roles) {
      const byKey = roleIdByKey.get(r.key);
      if (byKey != null) roleIds.add(byKey);
      else if (Number.isInteger(r.role_id) && r.role_id > 0) {
        const exists = await tx.role.findFirst({
          where: { id: r.role_id, tenant_id: tenantId },
          select: { id: true }
        });
        if (exists) roleIds.add(exists.id);
      }
    }
    const fallbackRoleId = roleIdByKey.get(snapshot.role_key);
    if (roleIds.size === 0 && fallbackRoleId != null) roleIds.add(fallbackRoleId);

    if (roleIds.size > 0) {
      await tx.userRole.createMany({
        data: [...roleIds].map((role_id) => ({ user_id: userId, role_id })),
        skipDuplicates: true
      });
    }

    const permKeys = [...new Set(snapshot.permissions.map((p) => p.key.trim()).filter(Boolean))];
    const pidMap = await ensurePermissionIdsForKeys(tx, tenantId, permKeys);
    for (const p of snapshot.permissions) {
      const pid = pidMap.get(p.key.trim());
      if (pid == null) continue;
      const effect = p.effect === "deny" ? "deny" : "allow";
      await tx.userPermission.deleteMany({ where: { user_id: userId, permission_id: pid } });
      await tx.userPermission.create({
        data: { user_id: userId, permission_id: pid, effect }
      });
    }

    return {
      restored_permissions: snapshot.permissions.length,
      restored_roles: roleIds.size
    };
  });
}

export async function findLatestAccessResetLog(
  tenantId: number,
  userId: number
): Promise<{ id: number; old_value: Prisma.JsonValue; created_at: Date } | null> {
  return prisma.accessLog.findFirst({
    where: {
      tenant_id: tenantId,
      target_user_id: userId,
      action_type: "access.reset"
    },
    orderBy: { created_at: "desc" },
    select: { id: true, old_value: true, created_at: true }
  });
}
