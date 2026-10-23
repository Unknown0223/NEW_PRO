import type { YmInt } from "./payroll.scheme.types";

export type SchemeSelector = {
  id: number;
  roles: string[];
  branches: string[];
  trade_direction_ids: number[];
  positions: string[];
  valid_from: YmInt;
  valid_to: YmInt | null;
  is_active: boolean;
};

export type SelectTarget = { role: string; branch: string | null; trade_direction_id: number | null; position: string | null };

export function schemeMatches(s: SchemeSelector, u: SelectTarget, ym: YmInt): boolean {
  if (!s.is_active || s.valid_from > ym || (s.valid_to != null && s.valid_to < ym)) return false;
  if (!s.roles.includes(u.role)) return false;
  if (s.branches.length && (!u.branch || !s.branches.includes(u.branch))) return false;
  if (s.trade_direction_ids.length && (u.trade_direction_id == null || !s.trade_direction_ids.includes(u.trade_direction_id))) return false;
  if (s.positions.length && (!u.position || !s.positions.includes(u.position))) return false;
  return true;
}

const specificity = (s: SchemeSelector) =>
  (s.branches.length ? 1 : 0) + (s.trade_direction_ids.length ? 1 : 0) + (s.positions.length ? 1 : 0);

/** Eng aniq mos sxema: ko'proq filtr → keyinroq boshlangan versiya → kichik id. */
export function pickScheme<T extends SchemeSelector>(schemes: T[], u: SelectTarget, ym: YmInt): T | null {
  const hits = schemes.filter((s) => schemeMatches(s, u, ym));
  hits.sort((a, b) => specificity(b) - specificity(a) || b.valid_from - a.valid_from || a.id - b.id);
  return hits[0] ?? null;
}

/** Xodim farqi: shu oyda amal qiladiganlardan eng kech boshlangani. */
export function activeOverrides(
  rows: Array<{ rule_code: string; amount: number; valid_from: YmInt; valid_to: YmInt | null }>,
  ym: YmInt
): Map<string, number> {
  const best = new Map<string, { amount: number; from: number }>();
  for (const r of rows) {
    if (r.valid_from > ym || (r.valid_to != null && r.valid_to < ym)) continue;
    const cur = best.get(r.rule_code);
    if (!cur || r.valid_from >= cur.from) best.set(r.rule_code, { amount: r.amount, from: r.valid_from });
  }
  return new Map([...best].map(([k, v]) => [k, v.amount]));
}

export const ymAdd = (ym: YmInt, delta: number): YmInt => {
  const total = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
};
