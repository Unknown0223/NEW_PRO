/** Web «Новый» tahrir — bonus tasdiqlash modal yordamchilari. */

export type OrderBonusGiftProductPreview = {
  product_id: number;
  name: string;
  bonus_qty?: number | null;
  purchased_qty?: number | null;
  available_qty?: number | null;
};

export type OrderBonusEligiblePreview = {
  rule_id: number;
  name: string;
  type: string;
  bonus_qty: number;
  max_bonus_qty: number | null;
  allow_gift_swap: boolean;
  gift_selection_kind?: string;
  gift_products: OrderBonusGiftProductPreview[];
};

export type OrderBonusStrategyPreview = {
  strategy_id: number;
  name: string;
  max_select: number;
  eligible_rule_ids: number[];
  auto_selected_rule_ids: number[];
  requires_choice: boolean;
};

export type OrderBonusPreviewResponse = {
  eligible_bonuses: OrderBonusEligiblePreview[];
  strategies?: OrderBonusStrategyPreview[];
  strategy_selections?: { strategy_id: number; rule_ids: number[] }[];
  auto_apply?: {
    bonus_rule_ids?: number[];
    bonus_gifts?: { product_id: number; qty: number }[];
  };
};

export type BonusGiftLinePayload = {
  bonus_rule_id: number;
  product_id: number;
  qty: number;
};

export type BonusStrategySelectionPayload = {
  strategy_id: number;
  rule_ids: number[];
};

/** Qoida bo‘yicha maksimal beriladigan bonus dona. */
export function maxBonusQtyForRule(rule: OrderBonusEligiblePreview): number {
  const earned = Number(rule.bonus_qty) || 0;
  const cap = rule.max_bonus_qty != null ? Number(rule.max_bonus_qty) : null;
  if (cap != null && Number.isFinite(cap) && cap > 0) {
    return Math.min(earned, cap);
  }
  return Math.max(0, earned);
}

/** Input qiymatini 0..max oralig‘iga siqadi. */
export function clampGiftQty(raw: string, max: number): number {
  const n = Number.parseFloat(String(raw).replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  const maxSafe = Math.max(0, max);
  return Math.min(maxSafe, Math.floor(n));
}

/** Preview dan boshlang‘ich gift qty map (ruleId → productId → qty). */
export function initialGiftQtyMap(
  bonuses: OrderBonusEligiblePreview[],
  autoGifts?: { product_id: number; qty: number }[]
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const autoByPid = new Map<number, number>();
  for (const g of autoGifts ?? []) {
    autoByPid.set(g.product_id, (autoByPid.get(g.product_id) ?? 0) + g.qty);
  }

  for (const rule of bonuses) {
    const max = maxBonusQtyForRule(rule);
    const byPid: Record<string, string> = {};
    let remaining = max;
    const gifts =
      rule.gift_products.length > 0
        ? rule.gift_products
        : [];

    if (gifts.length === 0 && max > 0 && autoByPid.size > 0) {
      const autoFill: Record<string, string> = {};
      let remaining = max;
      for (const [pid, qAuto] of autoByPid) {
        const q = Math.min(remaining, Math.max(0, Math.floor(qAuto)));
        if (q > 0) {
          autoFill[String(pid)] = String(q);
          remaining -= q;
        }
      }
      if (Object.keys(autoFill).length > 0) {
        out[String(rule.rule_id)] = autoFill;
      }
      continue;
    }

    for (const g of gifts) {
      const suggested =
        g.bonus_qty != null && Number(g.bonus_qty) > 0
          ? Number(g.bonus_qty)
          : (autoByPid.get(g.product_id) ?? 0);
      const q = Math.min(remaining, Math.max(0, Math.floor(suggested)));
      if (q > 0) {
        byPid[String(g.product_id)] = String(q);
        remaining -= q;
      } else {
        byPid[String(g.product_id)] = "";
      }
    }

    // Bitta gift mahsulot bo‘lsa va hech narsa tanlanmagan — max ni to‘ldiramiz
    if (gifts.length === 1 && remaining === max && max > 0) {
      byPid[String(gifts[0]!.product_id)] = String(max);
    }

    out[String(rule.rule_id)] = byPid;
  }
  return out;
}

export function buildGiftLinesFromQtyMap(
  bonuses: OrderBonusEligiblePreview[],
  qtyMap: Record<string, Record<string, string>>
): BonusGiftLinePayload[] {
  const lines: BonusGiftLinePayload[] = [];
  for (const rule of bonuses) {
    const max = maxBonusQtyForRule(rule);
    if (max <= 0) continue;
    const byPid = qtyMap[String(rule.rule_id)] ?? {};
    let used = 0;
    for (const [pidStr, raw] of Object.entries(byPid)) {
      const pid = Number.parseInt(pidStr, 10);
      if (!Number.isFinite(pid) || pid < 1) continue;
      const q = clampGiftQty(raw, max - used);
      if (q <= 0) continue;
      lines.push({ bonus_rule_id: rule.rule_id, product_id: pid, qty: q });
      used += q;
    }
  }
  return lines;
}

export function initialStrategySelections(
  strategies: OrderBonusStrategyPreview[] | undefined
): BonusStrategySelectionPayload[] {
  const out: BonusStrategySelectionPayload[] = [];
  for (const s of strategies ?? []) {
    const ids =
      s.auto_selected_rule_ids.length > 0
        ? s.auto_selected_rule_ids
        : s.eligible_rule_ids.slice(0, Math.max(1, s.max_select));
    if (ids.length > 0) {
      out.push({ strategy_id: s.strategy_id, rule_ids: ids.slice(0, s.max_select) });
    }
  }
  return out;
}

export function toggleStrategyRule(
  current: BonusStrategySelectionPayload[],
  strategy: OrderBonusStrategyPreview,
  ruleId: number
): BonusStrategySelectionPayload[] {
  const others = current.filter((s) => s.strategy_id !== strategy.strategy_id);
  const prev = current.find((s) => s.strategy_id === strategy.strategy_id)?.rule_ids ?? [];
  const has = prev.includes(ruleId);
  let next = has ? prev.filter((id) => id !== ruleId) : [...prev, ruleId];
  if (next.length > strategy.max_select) {
    next = next.slice(next.length - strategy.max_select);
  }
  if (next.length === 0 && strategy.eligible_rule_ids.length > 0) {
    // Kamida 1 ta tanlov saqlanadi
    next = [ruleId];
  }
  return [...others, { strategy_id: strategy.strategy_id, rule_ids: next }];
}

/** Web «Новый» tahrir: Сохранить oldidan bonus preview/tasdiq. */
export function shouldConfirmBonusOnWebNewEdit(opts: {
  isEditMode: boolean;
  hasEditOrderId: boolean;
  applyBonus: boolean;
  isPolkiSheet: boolean;
  isExchangeFlow: boolean;
}): boolean {
  if (!opts.isEditMode || !opts.hasEditOrderId) return false;
  if (!opts.applyBonus) return false;
  if (opts.isPolkiSheet || opts.isExchangeFlow) return false;
  return true;
}

/**
 * Tahrir ochilganda bonus rejimini yoqish.
 * Oldingi 0 bonus (`apply_bonus=false`) qayta hisoblanishi kerak — 3+1 kategoriya va h.k.
 */
export function hydrateApplyBonusForNewOrderEdit(): boolean {
  return true;
}

/** Modalda ko‘rsatiladigan sovg‘alar — qoida havzasi yoki auto_apply fallback. */
export function giftsForBonusConfirmModal(
  rule: OrderBonusEligiblePreview,
  autoGifts?: { product_id: number; qty: number }[]
): OrderBonusGiftProductPreview[] {
  const fromRule = rule.gift_products.filter((g) => g.product_id > 0);
  if (fromRule.length > 0) return fromRule;
  const seen = new Set<number>();
  const out: OrderBonusGiftProductPreview[] = [];
  for (const g of autoGifts ?? []) {
    if (g.product_id < 1 || g.qty <= 0 || seen.has(g.product_id)) continue;
    seen.add(g.product_id);
    out.push({
      product_id: g.product_id,
      name: `#${g.product_id}`,
      bonus_qty: g.qty
    });
  }
  return out;
}
