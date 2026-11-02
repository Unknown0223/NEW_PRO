/** Faqat «Настройки → Филиалы» dagi faol filiallar. Tanlovda kod va UUID chiqmaydi. */
export type BranchRefRow = {
  id?: string;
  name: string;
  code?: string | null;
  active?: boolean;
  is_active?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_CODE_RE = /^\d{1,8}$/;
const APOSTROPHE_RE = /['’ʼʻ`]/g;

function branchMatchKey(raw: string): string {
  return raw.trim().toLowerCase().replace(APOSTROPHE_RE, "");
}

function branchIsActive(b: BranchRefRow): boolean {
  const flag = b.active ?? b.is_active;
  return flag !== false;
}

export function isOpaqueBranchToken(raw: string): boolean {
  const t = raw.trim();
  return UUID_RE.test(t) || NUMERIC_CODE_RE.test(t);
}

export function branchLabelLookup(branches: BranchRefRow[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of branches ?? []) {
    if (!branchIsActive(b)) continue;
    const name = b.name.trim();
    if (!name) continue;
    for (const key of [name, b.code, b.id]) {
      const t = (key ?? "").trim().toLowerCase();
      if (!t) continue;
      map.set(t, name);
      const folded = branchMatchKey(t);
      if (folded) map.set(folded, name);
    }
  }
  return map;
}

/** Katalog nomi. Noma’lum kod va UUID null. */
export function branchVisibleName(
  raw: string | null | undefined,
  lookup: Map<string, string>
): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const named = lookup.get(t.toLowerCase()) ?? lookup.get(branchMatchKey(t));
  if (named) return named;
  if (isOpaqueBranchToken(t)) return null;
  return t;
}

export function activeBranchNamesFromProfile(
  branches: BranchRefRow[] | null | undefined
): string[] {
  return (branches ?? [])
    .filter((b) => branchIsActive(b))
    .map((b) => b.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));
}
