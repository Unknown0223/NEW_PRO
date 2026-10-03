/** «Операции» daraxti (GET /access/operations-tree) va foydalanuvchi qoralamasi uchun toza mantiq. */

export type AccessOpAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "void"
  | "restore"
  | "import"
  | "transfer"
  | "status"
  | "copy"
  | "assign"
  | "activate"
  | "deactivate"
  | "approve"
  | "history";

export type AccessTreeOperation = { key: string; action: AccessOpAction; label: string };
export type AccessTreeSection = { id: string; label: string; operations: AccessTreeOperation[] };
export type AccessTreeModule = { id: string; label: string; sections: AccessTreeSection[] };

export type AccessOpMatrixState = {
  from_role: boolean;
  user_effect: "none" | "allow" | "deny";
  effective: boolean;
};

export type TriState = "all" | "some" | "none";

/** VIEW — ko'rish (ko'k), qolganlari — amal (to'q sariq). */
export function accessOpKind(action: AccessOpAction): "view" | "action" {
  return action === "view" || action === "history" ? "view" : "action";
}

export function sectionKeys(section: AccessTreeSection): string[] {
  return section.operations.map((o) => o.key);
}

export function moduleKeys(mod: AccessTreeModule): string[] {
  return mod.sections.flatMap(sectionKeys);
}

export function treeKeys(tree: readonly AccessTreeModule[]): string[] {
  return tree.flatMap(moduleKeys);
}

export function triState(keys: readonly string[], isOn: (key: string) => boolean): TriState {
  if (keys.length === 0) return "none";
  let on = 0;
  for (const k of keys) if (isOn(k)) on++;
  if (on === 0) return "none";
  return on === keys.length ? "all" : "some";
}

function norm(s: string): string {
  return s.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
}

/**
 * Qidiruv: modul yoki bo'lim nomi mos kelsa — butun bo'lim; aks holda faqat mos operatsiyalar.
 * `keep` — qo'shimcha filtr (masalan «faqat tanlanganlar»).
 */
export function filterAccessTree(
  tree: readonly AccessTreeModule[],
  query: string,
  keep?: (op: AccessTreeOperation) => boolean
): AccessTreeModule[] {
  const q = norm(query);
  const out: AccessTreeModule[] = [];
  for (const mod of tree) {
    const modHit = q.length > 0 && norm(mod.label).includes(q);
    const sections: AccessTreeSection[] = [];
    for (const sec of mod.sections) {
      const secHit = modHit || (q.length > 0 && norm(sec.label).includes(q));
      const ops = sec.operations.filter((op) => {
        if (keep && !keep(op)) return false;
        if (!q || secHit) return true;
        return norm(op.label).includes(q) || op.key.toLowerCase().includes(q);
      });
      if (ops.length > 0) sections.push({ ...sec, operations: ops });
    }
    if (sections.length > 0) out.push({ ...mod, sections });
  }
  return out;
}

export function opStateLabel(row: AccessOpMatrixState | undefined): "Из роли" | "Лично" | "Запрещено" | "Не назначено" {
  if (!row) return "Не назначено";
  if (row.user_effect === "deny" && row.from_role) return "Запрещено";
  if (row.user_effect === "allow" && !row.from_role) return "Лично";
  if (row.from_role && row.effective) return "Из роли";
  if (row.user_effect === "allow") return "Лично";
  return "Не назначено";
}

/**
 * Qoralama → bitta PATCH tanasi.
 * Yoqish: rol ustidagi deny → remove; aks holda allow.
 * O'chirish: roldan kelgan → deny; faqat shaxsiy allow → remove (remove rolni qayta ochib yubormasin).
 */
export function buildOperationsDraftPatch(
  stateByKey: ReadonlyMap<string, AccessOpMatrixState>,
  draft: ReadonlyMap<string, boolean>
): { merge_permissions?: true; permissions?: string[]; denied_permissions?: string[]; remove_permission_keys?: string[] } | null {
  const permissions: string[] = [];
  const denied: string[] = [];
  const remove: string[] = [];
  for (const [key, want] of draft) {
    const row = stateByKey.get(key);
    const effective = Boolean(row?.effective);
    if (want === effective) continue;
    if (want) {
      if (row?.user_effect === "deny" && row.from_role) remove.push(key);
      else permissions.push(key);
    } else if (row?.from_role) {
      denied.push(key);
    } else {
      remove.push(key);
    }
  }
  if (!permissions.length && !denied.length && !remove.length) return null;
  const body: ReturnType<typeof buildOperationsDraftPatch> & object = {};
  if (remove.length) body.remove_permission_keys = remove.sort();
  if (permissions.length || denied.length) {
    body.merge_permissions = true;
    if (permissions.length) body.permissions = permissions.sort();
    if (denied.length) body.denied_permissions = denied.sort();
  }
  return body;
}

/** «Фильтр» kartochkasi: Родитель (modul) / Статус (manba) / Предоставление доступа. */
export type AccessOpsFilter = {
  module: string;
  source: "all" | "role" | "personal" | "denied";
  grant: "all" | "yes" | "no";
};

export const EMPTY_OPS_FILTER: AccessOpsFilter = { module: "", source: "all", grant: "all" };

/** «Запрещено» tanlanmasa — faqat amaldagi (effective) operatsiyalar ko'rinadi. */
export function opMatchesFilter(row: AccessOpMatrixState | undefined, canGrant: boolean, f: AccessOpsFilter): boolean {
  const label = opStateLabel(row);
  if (f.source === "denied") {
    if (label !== "Запрещено") return false;
  } else {
    if (!row?.effective) return false;
    if (f.source === "role" && label !== "Из роли") return false;
    if (f.source === "personal" && label !== "Лично") return false;
  }
  if (f.grant !== "all" && canGrant !== (f.grant === "yes")) return false;
  return true;
}

export function patchForKeys(
  stateByKey: ReadonlyMap<string, AccessOpMatrixState>,
  keys: readonly string[],
  want: boolean
): ReturnType<typeof buildOperationsDraftPatch> {
  return buildOperationsDraftPatch(stateByKey, new Map(keys.map((k) => [k, want] as const)));
}

/** Faqat haqiqiy farqlar (qoralamadagi qiymat joriy holatdan farq qiladi). */
export function draftChangedKeys(
  stateByKey: ReadonlyMap<string, AccessOpMatrixState>,
  draft: ReadonlyMap<string, boolean>
): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const [key, want] of draft) {
    const effective = Boolean(stateByKey.get(key)?.effective);
    if (want === effective) continue;
    (want ? added : removed).push(key);
  }
  return { added, removed };
}
