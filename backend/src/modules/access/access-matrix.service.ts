import { prisma } from "../../config/database";
import { catalogParentPathLabel } from "./permission-catalog-parent";
import {
  ACCESS_GRANT_DELEGATION_PREFIX,
  canGrantOperationToOthers,
  isMatrixOperationKey,
  normalizeGrantDelegationOperationKey
} from "./access-grant-delegation";
import { DEFAULT_PERMISSION_METADATA } from "./permission-catalog";
import { LEGACY_PERMISSION_METADATA } from "./legacy-permission-labels";
import { resolveUserPermissionKeysSplit } from "./rbac.service";

function resolveMatrixDescription(key: string, description: string | null): string | null {
  const opKey = normalizeGrantDelegationOperationKey(key);
  const raw = (description ?? "").trim();
  const garbage =
    raw.includes(`${ACCESS_GRANT_DELEGATION_PREFIX}${ACCESS_GRANT_DELEGATION_PREFIX}`) ||
    raw.startsWith(ACCESS_GRANT_DELEGATION_PREFIX) ||
    raw === opKey;
  if (raw && !garbage) return raw;
  const meta =
    DEFAULT_PERMISSION_METADATA[opKey as keyof typeof DEFAULT_PERMISSION_METADATA] ??
    LEGACY_PERMISSION_METADATA[opKey as keyof typeof LEGACY_PERMISSION_METADATA];
  if (meta?.description) return meta.description;
  return raw || null;
}

function isOperationRowKey(key: string): boolean {
  return isMatrixOperationKey(key);
}

export type AccessMatrixRow = {
  key: string;
  module: string;
  section: string | null;
  action: string | null;
  description: string | null;
  parent_path: string;
  from_role: boolean;
  user_effect: "none" | "allow" | "deny";
  effective: boolean;
  /** Shaxsiy: ushbu operatsiyani boshqalarga berish (`access.grant.<key>`). Rolga bog‘lanmaydi. */
  can_grant_others: boolean;
};

export async function getUserAccessMatrix(tenantId: number, userId: number, userRole: string): Promise<AccessMatrixRow[]> {
  const [allPerms, split] = await Promise.all([
    prisma.permission.findMany({
      where: { tenant_id: tenantId },
      select: { key: true, module: true, section: true, action: true, description: true },
      orderBy: [{ module: "asc" }, { key: "asc" }]
    }),
    resolveUserPermissionKeysSplit(tenantId, userId, userRole)
  ]);

  const roleKeys = split.fromRole;
  const effectiveSet = split.effective;

  const userEffectByKey = new Map<string, "allow" | "deny">();
  for (const row of split.userPerms) {
    const e = row.effect === "deny" ? "deny" : "allow";
    userEffectByKey.set(row.key, e);
  }

  const permByKey = new Map(allPerms.map((p) => [p.key, p]));
  const extraKeys = new Set<string>();
  for (const k of roleKeys) if (!permByKey.has(k)) extraKeys.add(k);
  for (const k of effectiveSet) if (!permByKey.has(k)) extraKeys.add(k);
  for (const k of userEffectByKey.keys()) if (!permByKey.has(k)) extraKeys.add(k);

  const rows: AccessMatrixRow[] = allPerms
    .filter((p) => isOperationRowKey(p.key))
    .map((p) => {
    const ue = userEffectByKey.get(p.key);
    return {
      key: p.key,
      module: p.module,
      section: p.section,
      action: p.action ?? null,
      description: resolveMatrixDescription(p.key, p.description),
      /** RU label — как в GET .../permissions/catalog (`catalogParentPathLabel`), не сырой `module / section`. */
      parent_path: catalogParentPathLabel(p.module, p.section),
      from_role: roleKeys.has(p.key),
      user_effect: ue === "allow" || ue === "deny" ? ue : "none",
      effective: effectiveSet.has(p.key),
      can_grant_others: canGrantOperationToOthers(userEffectByKey, p.key)
    };
  });

  for (const key of extraKeys) {
    if (permByKey.has(key) || !isOperationRowKey(key)) continue;
    const mod = key.split(".")[0] ?? "general";
    rows.push({
      key,
      module: mod,
      section: null,
      action: key.split(".").pop() ?? null,
      description: resolveMatrixDescription(key, null),
      parent_path: catalogParentPathLabel(mod, null),
      from_role: roleKeys.has(key),
      user_effect: userEffectByKey.get(key) === "allow" || userEffectByKey.get(key) === "deny" ? userEffectByKey.get(key)! : "none",
      effective: effectiveSet.has(key),
      can_grant_others: canGrantOperationToOthers(userEffectByKey, key)
    });
  }

  rows.sort((a, b) => (a.module === b.module ? a.key.localeCompare(b.key) : a.module.localeCompare(b.module)));
  return rows;
}
