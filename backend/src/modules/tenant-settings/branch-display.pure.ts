/** Filial tanlovida ko‘rinadigan nom. Kod va UUID hech qachon yozuv sifatida chiqmaydi. */

export type BranchLabelSource = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  active?: boolean | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_CODE_RE = /^\d{1,8}$/;
const APOSTROPHE_RE = /['’ʼʻ`]/g;

/** Apostrof farqi (Farg'ona / Fargona) bitta kalitga tushadi. */
export function branchMatchKey(raw: string): string {
  return raw.trim().toLowerCase().replace(APOSTROPHE_RE, "");
}

export function isOpaqueBranchToken(raw: string): boolean {
  const t = raw.trim();
  return UUID_RE.test(t) || NUMERIC_CODE_RE.test(t);
}

/** Kichik harfdagi kalit (nom, kod, id) → katalogdagi nom. */
export function branchLabelLookup(branches: BranchLabelSource[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of branches) {
    if (b.active === false) continue;
    const name = (b.name ?? "").trim();
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

/** Tanlov va jadval yozuvi. Noma’lum kod va UUID yashiriladi. */
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

export function uniqueBranchVisibleNames(
  raws: Array<string | null | undefined>,
  lookup: Map<string, string>
): string[] {
  const set = new Set<string>();
  for (const raw of raws) {
    const name = branchVisibleName(raw, lookup);
    if (name) set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ru"));
}

/**
 * Tanlangan nom (yoki eski kod) bo‘yicha bazadagi barcha kalitlar:
 * nom, kod va id. Filtr shu ro‘yxat bilan solishtiriladi.
 */
export function expandBranchFilterKeys(selected: string[], branches: BranchLabelSource[]): string[] {
  const want = new Set(selected.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const wantFold = new Set(selected.map((s) => branchMatchKey(s)).filter(Boolean));
  if (want.size === 0) return [];
  const keys = new Set<string>();
  for (const s of selected) {
    const t = s.trim();
    if (t) keys.add(t);
  }
  for (const b of branches) {
    if (b.active === false) continue;
    const aliases = [(b.name ?? "").trim(), (b.code ?? "").trim(), (b.id ?? "").trim()].filter(Boolean);
    if (aliases.some((a) => want.has(a.toLowerCase()) || wantFold.has(branchMatchKey(a)))) {
      for (const a of aliases) {
        keys.add(a);
        const plain = a.replace(APOSTROPHE_RE, "");
        if (plain) keys.add(plain);
      }
    }
  }
  return [...keys];
}
