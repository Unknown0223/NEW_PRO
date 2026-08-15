import type { BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { primaryQtyCondition } from "../bonus-rules/bonus-rules.qty";
import { bonusGiftSelectionMeta } from "../orders/bonus-gift-selection";
import type { QtyBonusPeek } from "../orders/order-bonus-qty";
import { parseBonusStackPolicy, resolveBonusSlotTakeCount } from "../orders/bonus-stack-policy";
import { mapGiftProducts, type GiftProductPreview } from "./mobile-order-bonus-preview.query";

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
  step_qty: number | null;
  bonus_step_qty: number | null;
  trigger_product_ids: number[];
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
      const prevG = gifts.get(g.product_id);
      if (!prevG) {
        gifts.set(g.product_id, g);
        continue;
      }
      const prevEarned = prevG.bonus_qty ?? 0;
      const rowEarned = g.bonus_qty ?? 0;
      gifts.set(g.product_id, {
        ...g,
        bonus_qty: prevEarned + rowEarned,
        purchased_qty: Math.max(prevG.purchased_qty ?? 0, g.purchased_qty ?? 0)
      });
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

/** Qty peeklarini qoida bo‘yicha birlashtiradi; har SKU uchun `bonus_qty` saqlanadi. */
export function buildQtyEligibleRowsFromPeeks(
  qtyPeeks: QtyBonusPeek[],
  productMap: Map<number, { id: number; name: string; category: { name: string } | null }>,
  availableByProductId: Map<number, number>,
  qtyByProduct: ReadonlyMap<number, number>,
  /** Qoida bo‘yicha ruxsat etilgan sovg‘a SKU (bonus_product_ids / kategoriya havzasi). */
  allowedGiftsByRuleId?: ReadonlyMap<number, readonly number[]>
): EligibleBonusRow[] {
  const groups = new Map<number, { rule: BonusRuleRow; peeks: QtyBonusPeek[] }>();
  for (const peek of qtyPeeks) {
    const cur = groups.get(peek.rule.id);
    if (!cur) {
      groups.set(peek.rule.id, { rule: peek.rule, peeks: [peek] });
      continue;
    }
    cur.peeks.push(peek);
  }

  const rows: EligibleBonusRow[] = [];
  for (const { rule, peeks } of groups.values()) {
    const bonusByPid = new Map<number, number>();
    const giftPidSet = new Set<number>();
    let totalBonus = 0;
    let defaultGiftPid: number | null = null;

    for (const p of peeks) {
      totalBonus += p.bonusQty;
      if (p.giftPid > 0) {
        giftPidSet.add(p.giftPid);
        bonusByPid.set(p.giftPid, (bonusByPid.get(p.giftPid) ?? 0) + p.bonusQty);
        if (defaultGiftPid == null && p.bonusQty > 0) defaultGiftPid = p.giftPid;
      }
    }
    // Aniq belgilangan bonus SKU’lar — peek/auto tanlovdan tashqari ham UI havzasiga.
    for (const pid of rule.bonus_product_ids) {
      if (pid > 0) giftPidSet.add(pid);
    }
    for (const pid of allowedGiftsByRuleId?.get(rule.id) ?? []) {
      if (pid > 0) giftPidSet.add(pid);
    }
    const metaProbe = bonusGiftSelectionMeta(
      rule,
      Math.max(
        giftPidSet.size,
        rule.bonus_product_ids.length,
        rule.product_ids.length,
        allowedGiftsByRuleId?.get(rule.id)?.length ?? 0
      )
    );
    // Assortiment: trigger = sovg‘a. pick/category da faqat ruxsat etilgan bonus SKU.
    if (metaProbe.kind === "assortment_auto") {
      for (const pid of rule.product_ids) {
        if (pid > 0) giftPidSet.add(pid);
      }
    }

    const giftIds = [...giftPidSet];
    const gift_products = mapGiftProducts(
      giftIds,
      productMap,
      availableByProductId,
      qtyByProduct,
      bonusByPid
    );
    const meta = bonusGiftSelectionMeta(
      rule,
      Math.max(giftIds.length, rule.product_ids.length, gift_products.length)
    );
    const primary = primaryQtyCondition(rule);

    rows.push({
      rule_id: rule.id,
      name: rule.name,
      type: rule.type,
      bonus_qty: totalBonus,
      max_bonus_qty: totalBonus > 0 ? totalBonus : null,
      prerequisite_rule_ids: rule.prerequisite_rule_ids ?? [],
      default_gift_product_id: defaultGiftPid ?? giftIds[0] ?? null,
      gift_selection_kind: meta.kind,
      allow_gift_swap: meta.allow_gift_swap,
      // JSON da number bo‘lishi shart (Decimal/string mobil `as num` ni sindiradi).
      step_qty: primary?.step_qty != null ? Number(primary.step_qty) : null,
      bonus_step_qty: primary?.bonus_qty != null ? Number(primary.bonus_qty) : null,
      trigger_product_ids: [...rule.product_ids],
      gift_products
    });
  }
  return rows;
}
