/**
 * Klientlar filtri: bitta / ko‘p tanlov qiymatlari.
 * Ko‘p tanlov `|` bilan saqlanadi (vergul zonalar matnida bo‘lishi mumkin).
 */

export const CLIENT_FILTER_MULTI_SEP = "|";

/** Ko‘p tanlov — faqat ro‘yxatdagi qiymatlar, dublikatsiz */
export function joinMultiFilterValues(values: string[]): string {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join(CLIENT_FILTER_MULTI_SEP);
}

export function splitMultiFilterValues(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const sep = t.includes(CLIENT_FILTER_MULTI_SEP) ? CLIENT_FILTER_MULTI_SEP : ",";
  return [...new Set(t.split(sep).map((s) => s.trim()).filter(Boolean))];
}

export function pruneToAllowedOptions(values: string[], allowed: Set<string>): string[] {
  return values.filter((v) => allowed.has(v));
}

/** Bitta tanlov: 0 yoki 1 ta qiymat */
export function uiFromSingleValue(raw: string): string[] {
  const v = raw.trim();
  return v ? [v] : [];
}

export function singleValueFromUi(vals: string[]): string {
  return vals[0]?.trim() ?? "";
}

/** «Все» / bo‘sh → ""; Да/Нет */
export function parseTristateUi(vals: string[]): "" | "yes" | "no" {
  const v = vals[0]?.trim();
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  return "";
}

export function tristateToUi(filter: "" | "yes" | "no"): string[] {
  if (filter === "yes") return ["yes"];
  if (filter === "no") return ["no"];
  return [];
}

export function parseLocationUi(vals: string[]): "" | "yes" | "no" {
  return parseTristateUi(vals);
}

export function locationToUi(filter: "" | "yes" | "no"): string[] {
  return tristateToUi(filter);
}

/** API: bitta `agent_id` yoki ko‘p `agent_ids` */
export function appendPositiveIntListParam(
  params: URLSearchParams,
  singleKey: string,
  multiKey: string,
  raw: string
): void {
  const ids = splitMultiFilterValues(raw)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return;
  if (uniq.length === 1) params.set(singleKey, String(uniq[0]));
  else params.set(multiKey, uniq.join(","));
}

export function appendStringListParam(params: URLSearchParams, key: string, raw: string): void {
  const items = splitMultiFilterValues(raw);
  if (items.length === 0) return;
  if (items.length === 1) params.set(key, items[0]!);
  else params.set(`${key}s`, items.join(","));
}
