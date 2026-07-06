/** Zakazda saqlangan bonus qoida snapshot (backend bilan mos). */
export type AppliedBonusRuleSnapshot = {
  rule_id: number;
  name: string;
  type: string;
  buy_qty: number | null;
  free_qty: number | null;
  min_sum: number | null;
  sum_threshold_scope: string;
  discount_pct: number | null;
  priority: number;
  scope_restrict_assortment?: boolean;
  scope_restrict_category?: boolean;
  product_ids: number[];
  product_category_ids: number[];
  captured_at: string;
};

export function formatBonusRuleSnapshotLine(s: AppliedBonusRuleSnapshot): string {
  const scopeParts: string[] = [];
  if (s.scope_restrict_assortment) scopeParts.push("ассортимент");
  if (s.scope_restrict_category) scopeParts.push("категория");
  const scope = scopeParts.length > 0 ? scopeParts.join(" + ") : "без ограничения SKU";
  if (s.type === "qty") {
    const step = s.buy_qty ?? "—";
    const bonus = s.free_qty ?? "—";
    return `${s.name}: ${step}+${bonus} (${scope})`;
  }
  if (s.type === "sum") {
    return `${s.name}: мин. ${s.min_sum ?? "—"} (${scope})`;
  }
  if (s.type === "discount") {
    return `${s.name}: ${s.discount_pct ?? "—"}% (${scope})`;
  }
  return `${s.name} (${s.type})`;
}
