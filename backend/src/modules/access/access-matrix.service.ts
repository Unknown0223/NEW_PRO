import { prisma } from "../../config/database";
import { catalogParentPathLabel } from "./permission-catalog-parent";
import { resolveUserPermissionKeysSplit } from "./rbac.service";

export type AccessMatrixRow = {
  key: string;
  module: string;
  section: string | null;
  description: string | null;
  parent_path: string;
  from_role: boolean;
  user_effect: "none" | "allow" | "deny";
  effective: boolean;
};

export async function getUserAccessMatrix(tenantId: number, userId: number, userRole: string): Promise<AccessMatrixRow[]> {
  const [allPerms, split] = await Promise.all([
    prisma.permission.findMany({
      where: { tenant_id: tenantId },
      select: { key: true, module: true, section: true, description: true },
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

  const rows: AccessMatrixRow[] = allPerms.map((p) => {
    const ue = userEffectByKey.get(p.key);
    return {
      key: p.key,
      module: p.module,
      section: p.section,
      description: p.description,
      /** RU label — как в GET .../permissions/catalog (`catalogParentPathLabel`), не сырой `module / section`. */
      parent_path: catalogParentPathLabel(p.module, p.section),
      from_role: roleKeys.has(p.key),
      user_effect: ue === "allow" || ue === "deny" ? ue : "none",
      effective: effectiveSet.has(p.key)
    };
  });

  for (const key of extraKeys) {
    if (permByKey.has(key)) continue;
    const mod = key.split(".")[0] ?? "general";
    rows.push({
      key,
      module: mod,
      section: null,
      description: null,
      parent_path: catalogParentPathLabel(mod, null),
      from_role: roleKeys.has(key),
      user_effect: userEffectByKey.get(key) === "allow" || userEffectByKey.get(key) === "deny" ? userEffectByKey.get(key)! : "none",
      effective: effectiveSet.has(key)
    });
  }

  rows.sort((a, b) => (a.module === b.module ? a.key.localeCompare(b.key) : a.module.localeCompare(b.module)));
  return rows;
}
