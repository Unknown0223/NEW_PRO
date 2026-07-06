/** Spravochnik (katalog) qiymatlari — faqat tizimda ro‘yxatdan o‘tgan faol yozuvlar. */

export type TradeDirectionCatalogRow = {
  name: string;
  code?: string | null;
  is_active?: boolean;
};

/** Agent/ekspeditor filteri va formalar: faol «Направление торговли» yorliqlari. */
export function tradeDirectionFilterLabels(rows: TradeDirectionCatalogRow[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows ?? []) {
    if (r.is_active === false) continue;
    const label = (r.code?.trim() || r.name?.trim() || "").trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out.sort((a, b) => a.localeCompare(b, "ru"));
}

export { activeBranchNamesFromProfile } from "@/lib/branch-options";
