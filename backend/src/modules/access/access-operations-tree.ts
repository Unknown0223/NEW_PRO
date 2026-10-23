import {
  PERMISSION_ACTION_ORDER,
  PERMISSION_MODULE_LABEL_RU,
  PERMISSION_SECTIONS,
  buildStructuredPermissionCatalog,
  permissionKey,
  permissionOperationLabel,
  permissionTreeSectionLabel,
  type PermissionAction,
  type StructuredPermissionEntry
} from "./permission-model";
import { PERMISSION_OP_LABEL_RU } from "./permission-op-labels";

export type AccessTreeOperation = { key: string; action: PermissionAction; label: string };
export type AccessTreeSection = { id: string; label: string; operations: AccessTreeOperation[] };
export type AccessTreeModule = { id: string; label: string; sections: AccessTreeSection[] };

type PlacedOperation = {
  moduleLabel: string;
  sectionLabel: string;
  sectionId: string;
  /** Operatsiya o'z bo'limidan boshqa bo'limga ko'chirilgan. */
  moved: boolean;
  op: AccessTreeOperation;
};

function placedOperations(): PlacedOperation[] {
  const out: PlacedOperation[] = [];
  for (const def of PERMISSION_SECTIONS) {
    const moduleLabel = def.groupRu ?? PERMISSION_MODULE_LABEL_RU[def.module] ?? def.module;
    const single = def.actions.length === 1;
    const homeLabel = def.treeSectionRu ?? def.labelRu;
    const actions = [...def.actions].sort((a, b) => PERMISSION_ACTION_ORDER[a] - PERMISSION_ACTION_ORDER[b]);
    for (const action of actions) {
      const key = permissionKey(def.module, def.section, action);
      const label = single && !PERMISSION_OP_LABEL_RU[key] ? def.labelRu : permissionOperationLabel(key, action);
      const sectionLabel = permissionTreeSectionLabel(def, key);
      out.push({
        moduleLabel,
        sectionLabel,
        sectionId: `${def.module}.${def.section}`,
        moved: sectionLabel !== homeLabel,
        op: { key, action, label }
      });
    }
  }
  return out;
}

/**
 * «Доступ» operatsiyalar daraxti: Modul → Bo'lim → Operatsiya.
 * Bir modul ichida bir xil nomli bo'limlar birlashadi (`treeSectionRu`, operatsiya override);
 * bo'lim tartibi — unga tegishli birinchi ta'rif bo'yicha (ko'chirilgan operatsiyalar tartibni o'zgartirmaydi).
 */
export function buildAccessOperationsTree(): AccessTreeModule[] {
  const placed = placedOperations();
  const modules = new Map<string, AccessTreeModule>();
  const sections = new Map<string, AccessTreeSection>();
  const ensureSection = (p: PlacedOperation): AccessTreeSection => {
    const sectionKey = `${p.moduleLabel}\u0000${p.sectionLabel}`;
    let section = sections.get(sectionKey);
    if (section) return section;
    let mod = modules.get(p.moduleLabel);
    if (!mod) {
      mod = { id: p.moduleLabel, label: p.moduleLabel, sections: [] };
      modules.set(p.moduleLabel, mod);
    }
    section = { id: p.sectionId, label: p.sectionLabel, operations: [] };
    sections.set(sectionKey, section);
    mod.sections.push(section);
    return section;
  };
  for (const p of placed) if (!p.moved) ensureSection(p);
  for (const p of placed) ensureSection(p).operations.push(p.op);
  return [...modules.values()].map(flattenSingleSectionModule);
}

/** Bitta bo'limli modul («Аудит → Аудит») — operatsiyalar modul ostida tekis (har biri o'z qatori). */
function flattenSingleSectionModule(mod: AccessTreeModule): AccessTreeModule {
  if (mod.sections.length !== 1) return mod;
  const only = mod.sections[0]!;
  if (only.operations.length <= 1) return mod;
  return { ...mod, sections: only.operations.map((op) => ({ id: op.key, label: op.label, operations: [op] })) };
}

let catalogByKeyCache: Map<string, StructuredPermissionEntry> | null = null;

export function structuredCatalogByKey(): Map<string, StructuredPermissionEntry> {
  if (!catalogByKeyCache) {
    catalogByKeyCache = new Map(buildStructuredPermissionCatalog().map((e) => [e.key, e]));
  }
  return catalogByKeyCache;
}
