import {
  PERMISSION_ACTION_ORDER,
  PERMISSION_MODULE_LABEL_RU,
  PERMISSION_SECTIONS,
  buildStructuredPermissionCatalog,
  permissionKey,
  permissionOperationLabel,
  type PermissionAction,
  type StructuredPermissionEntry
} from "./permission-model";

export type AccessTreeOperation = { key: string; action: PermissionAction; label: string };
export type AccessTreeSection = { id: string; label: string; operations: AccessTreeOperation[] };
export type AccessTreeModule = { id: string; label: string; sections: AccessTreeSection[] };

/** «Доступ» operatsiyalar daraxti: Modul → Bo'lim → Operatsiya (katalog tartibida). */
export function buildAccessOperationsTree(): AccessTreeModule[] {
  const modules = new Map<string, AccessTreeModule>();
  for (const def of PERMISSION_SECTIONS) {
    const label = def.groupRu ?? PERMISSION_MODULE_LABEL_RU[def.module] ?? def.module;
    let mod = modules.get(label);
    if (!mod) {
      mod = { id: label, label, sections: [] };
      modules.set(label, mod);
    }
    const operations = [...def.actions]
      .sort((a, b) => PERMISSION_ACTION_ORDER[a] - PERMISSION_ACTION_ORDER[b])
      .map((action) => {
        const key = permissionKey(def.module, def.section, action);
        return { key, action, label: permissionOperationLabel(key, action) };
      });
    mod.sections.push({ id: `${def.module}.${def.section}`, label: def.labelRu, operations });
  }
  return [...modules.values()];
}

let catalogByKeyCache: Map<string, StructuredPermissionEntry> | null = null;

export function structuredCatalogByKey(): Map<string, StructuredPermissionEntry> {
  if (!catalogByKeyCache) {
    catalogByKeyCache = new Map(buildStructuredPermissionCatalog().map((e) => [e.key, e]));
  }
  return catalogByKeyCache;
}
