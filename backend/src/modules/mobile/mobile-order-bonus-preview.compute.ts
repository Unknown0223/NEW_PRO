import type { BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { parseBonusStackPolicy, resolveBonusSlotTakeCount } from "../orders/bonus-stack-policy";
import type { GiftProductPreview } from "./mobile-order-bonus-preview.query";

export type EligibleBonusRow = {
  rule_id: number;
  name: string;
  type: string;
  bonus_qty: number;
  max_bonus_qty: number | null;
  prerequisite_rule_ids: number[];
  default_gift_product_id: number | null;
  gift_selection_kind: string;
  allow_gift_swap: boolean;
  gift_products: GiftProductPreview[];
};

export function rulesLinked(a: BonusRuleRow, b: BonusRuleRow): boolean {
  const aPre = a.prerequisite_rule_ids ?? [];
  const bPre = b.prerequisite_rule_ids ?? [];
  return aPre.includes(b.id) || bPre.includes(a.id);
}

/** Mobil preview: stack siyosatiga mos barcha mos bonuslar (faqat bittasini emas). */
export function filterEligibleBonusesForPreview(
  rows: EligibleBonusRow[],
  stackPolicy: ReturnType<typeof parseBonusStackPolicy>,
  appliedAutoBonusRuleIds: number[]
): EligibleBonusRow[] {
  const eligible = rows.filter((r) => r.bonus_qty > 0);
  if (eligible.length === 0) return [];

  if (stackPolicy.mode === "all") {
    return eligible;
  }

  const take = resolveBonusSlotTakeCount(eligible.length, stackPolicy);
  if (take <= 0) return [];

  const ordered: EligibleBonusRow[] = [];
  for (const id of appliedAutoBonusRuleIds) {
    const hit = eligible.find((r) => r.rule_id === id);
    if (hit && !ordered.some((x) => x.rule_id === hit.rule_id)) ordered.push(hit);
  }
  for (const r of eligible) {
    if (!ordered.some((x) => x.rule_id === r.rule_id)) ordered.push(r);
  }
  return ordered.slice(0, take);
}

export function dedupeEligibleBonusRows(rows: EligibleBonusRow[]): EligibleBonusRow[] {
  const byId = new Map<number, EligibleBonusRow>();
  for (const row of rows) {
    const prev = byId.get(row.rule_id);
    if (!prev) {
      byId.set(row.rule_id, row);
      continue;
    }
    const gifts = new Map(prev.gift_products.map((g) => [g.product_id, g]));
    for (const g of row.gift_products) {
      gifts.set(g.product_id, g);
    }
    byId.set(row.rule_id, {
      ...prev,
      bonus_qty: prev.bonus_qty + row.bonus_qty,
      max_bonus_qty:
        (prev.max_bonus_qty ?? 0) + (row.max_bonus_qty ?? row.bonus_qty),
      default_gift_product_id: prev.default_gift_product_id ?? row.default_gift_product_id,
      gift_products: [...gifts.values()]
    });
  }
  return [...byId.values()];
}
