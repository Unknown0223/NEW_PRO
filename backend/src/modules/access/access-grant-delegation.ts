/** Foydalanuvchi ma’lum operatsiyani boshqalarga berishi — faqat shaxsiy `user_permissions`. */

import { prisma } from "../../config/database";

export const ACCESS_GRANT_DELEGATION_PREFIX = "access.grant.";

export function isGrantDelegationKey(key: string): boolean {
  return key.startsWith(ACCESS_GRANT_DELEGATION_PREFIX);
}

/** Nested `access.grant.access.grant.*` — operatsiya emas. */
export function isCorruptedGrantArtifactKey(key: string): boolean {
  return key.trim().includes(`${ACCESS_GRANT_DELEGATION_PREFIX}${ACCESS_GRANT_DELEGATION_PREFIX}`);
}

function isCanonicalGrantDelegationKey(key: string): boolean {
  if (!isGrantDelegationKey(key)) return false;
  return key === toGrantDelegationKey(fromGrantDelegationKey(key) ?? key);
}

/** Jadvalda ko‘rsatiladigan haqiqiy operatsiya kaliti. */
export function isMatrixOperationKey(key: string): boolean {
  if (isCorruptedGrantArtifactKey(key)) return false;
  if (isGrantDelegationKey(key)) return false;
  return true;
}

/** `access.grant.access.grant.foo` → `foo` — noto‘g‘ri nested grant kalitlarini tuzatish. */
export function normalizeGrantDelegationOperationKey(operationKey: string): string {
  let op = operationKey.trim();
  while (op.startsWith(ACCESS_GRANT_DELEGATION_PREFIX)) {
    op = op.slice(ACCESS_GRANT_DELEGATION_PREFIX.length).trim();
  }
  return op;
}

export function toGrantDelegationKey(operationKey: string): string {
  const op = normalizeGrantDelegationOperationKey(operationKey);
  if (!op) return ACCESS_GRANT_DELEGATION_PREFIX.slice(0, -1);
  return `${ACCESS_GRANT_DELEGATION_PREFIX}${op}`;
}

export function fromGrantDelegationKey(delegationKey: string): string | null {
  if (!isGrantDelegationKey(delegationKey)) return null;
  const op = normalizeGrantDelegationOperationKey(delegationKey);
  return op.length > 0 ? op : null;
}

export function canGrantOperationToOthers(
  userEffectByKey: ReadonlyMap<string, "allow" | "deny">,
  operationKey: string
): boolean {
  return userEffectByKey.get(toGrantDelegationKey(operationKey)) === "allow";
}

/** GET detail: foydalanuvchi qaysi operatsiyalarni boshqalarga bera oladi. */
export async function loadGrantDelegationOperationKeys(
  tenantId: number,
  userId: number
): Promise<string[]> {
  const rows = await prisma.userPermission.findMany({
    where: {
      user_id: userId,
      effect: "allow",
      permission: { tenant_id: tenantId, key: { startsWith: ACCESS_GRANT_DELEGATION_PREFIX } }
    },
    select: { permission: { select: { key: true } } }
  });
  const out = new Set<string>();
  for (const row of rows) {
    const delegKey = row.permission.key;
    if (!isCanonicalGrantDelegationKey(delegKey)) continue;
    const op = fromGrantDelegationKey(delegKey);
    if (op && isMatrixOperationKey(op)) out.add(op);
  }
  return [...out];
}

/** Nested grant kalitlarini tuzatadi (idempotent). */
export async function repairNestedGrantDelegationKeys(
  tenantId: number,
  userId?: number
): Promise<{ removedArtifacts: number; relinked: number }> {
  let removedArtifacts = 0;
  let relinked = 0;

  const nestedPerms = await prisma.permission.findMany({
    where: {
      tenant_id: tenantId,
      key: { contains: `${ACCESS_GRANT_DELEGATION_PREFIX}${ACCESS_GRANT_DELEGATION_PREFIX}` }
    },
    select: { id: true, key: true }
  });

  const nonCanonical = await prisma.permission.findMany({
    where: {
      tenant_id: tenantId,
      key: { startsWith: ACCESS_GRANT_DELEGATION_PREFIX }
    },
    select: { id: true, key: true }
  });

  const toFix = [...nestedPerms, ...nonCanonical.filter((p) => !isCanonicalGrantDelegationKey(p.key))];
  const seen = new Set<number>();

  for (const bad of toFix) {
    if (seen.has(bad.id)) continue;
    seen.add(bad.id);

    const op = fromGrantDelegationKey(bad.key);
    if (!op || !isMatrixOperationKey(op)) {
      await prisma.userPermission.deleteMany({ where: { permission_id: bad.id, ...(userId != null ? { user_id: userId } : {}) } });
      const left = await prisma.userPermission.count({ where: { permission_id: bad.id } });
      if (left === 0) {
        await prisma.rolePermission.deleteMany({ where: { permission_id: bad.id } });
        await prisma.permission.delete({ where: { id: bad.id } }).catch(() => undefined);
      }
      removedArtifacts += 1;
      continue;
    }

    const canonKey = toGrantDelegationKey(op);
    const canon = await prisma.permission.upsert({
      where: { tenant_id_key: { tenant_id: tenantId, key: canonKey } },
      create: { tenant_id: tenantId, key: canonKey, module: "access" },
      update: {},
      select: { id: true }
    });

    const links = await prisma.userPermission.findMany({
      where: { permission_id: bad.id, ...(userId != null ? { user_id: userId } : {}), effect: "allow" },
      select: { user_id: true }
    });

    for (const link of links) {
      await prisma.userPermission.deleteMany({ where: { user_id: link.user_id, permission_id: bad.id } });
      await prisma.userPermission.upsert({
        where: { user_id_permission_id: { user_id: link.user_id, permission_id: canon.id } },
        create: { user_id: link.user_id, permission_id: canon.id, effect: "allow" },
        update: { effect: "allow" }
      });
      relinked += 1;
    }

    const remaining = await prisma.userPermission.count({ where: { permission_id: bad.id } });
    if (remaining === 0) {
      await prisma.rolePermission.deleteMany({ where: { permission_id: bad.id } });
      await prisma.permission.delete({ where: { id: bad.id } }).catch(() => undefined);
      removedArtifacts += 1;
    }
  }

  return { removedArtifacts, relinked };
}
