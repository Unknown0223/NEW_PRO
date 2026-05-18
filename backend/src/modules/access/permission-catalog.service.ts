import { prisma } from "../../config/database";
import { LEGACY_PERMISSION_METADATA } from "./legacy-permission-labels";
import { catalogParentPathLabel } from "./permission-catalog-parent";
import { DEFAULT_PERMISSION_METADATA } from "./permission-catalog";

function truncStr(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  return s.length <= max ? s : s.slice(0, max);
}

export type PermissionCatalogNode = {
  key: string;
  module: string;
  section: string | null;
  description: string | null;
  parent_path: string;
};

export type PermissionCatalogGrouped = {
  modules: {
    module: string;
    sections: {
      section: string | null;
      label: string;
      permissions: PermissionCatalogNode[];
    }[];
  }[];
  flat: PermissionCatalogNode[];
};

export async function syncDefaultPermissionMetadata(tenantId: number) {
  const defaultKeys = new Set(Object.keys(DEFAULT_PERMISSION_METADATA));
  const entries: [string, { description: string; section?: string }][] = [
    ...Object.entries(DEFAULT_PERMISSION_METADATA),
    ...Object.entries(LEGACY_PERMISSION_METADATA).filter(([k]) => !defaultKeys.has(k))
  ];

  for (const [key, meta] of entries) {
    const moduleKey = truncStr(key.split(".")[0] ?? "general", 120) ?? "general";
    await prisma.permission.upsert({
      where: { tenant_id_key: { tenant_id: tenantId, key } },
      create: {
        tenant_id: tenantId,
        key,
        module: moduleKey,
        section: truncStr(meta.section ?? null, 120),
        description: meta.description
      },
      update: {
        description: meta.description,
        section: truncStr(meta.section ?? null, 120),
        module: moduleKey
      }
    });
  }
}

export async function getPermissionCatalogGrouped(tenantId: number): Promise<PermissionCatalogGrouped> {
  await syncDefaultPermissionMetadata(tenantId);
  const rows = await prisma.permission.findMany({
    where: { tenant_id: tenantId },
    select: { key: true, module: true, section: true, description: true },
    orderBy: [{ module: "asc" }, { section: "asc" }, { key: "asc" }]
  });

  const flat: PermissionCatalogNode[] = rows.map((r) => ({
    key: r.key,
    module: r.module,
    section: r.section,
    description: r.description,
    parent_path: catalogParentPathLabel(r.module, r.section)
  }));

  const moduleMap = new Map<string, Map<string | null, PermissionCatalogNode[]>>();
  for (const n of flat) {
    if (!moduleMap.has(n.module)) moduleMap.set(n.module, new Map());
    const secMap = moduleMap.get(n.module)!;
    if (!secMap.has(n.section)) secMap.set(n.section, []);
    secMap.get(n.section)!.push(n);
  }

  const modules = [...moduleMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, secMap]) => ({
      module,
      sections: [...secMap.entries()]
        .sort(([a], [b]) => String(a ?? "").localeCompare(String(b ?? "")))
        .map(([section, permissions]) => ({
          section,
          label: section ?? module,
          permissions
        }))
    }));

  return { modules, flat };
}
