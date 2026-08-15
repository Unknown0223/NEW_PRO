import type { BonusRuleClauseRow, BonusRuleRow } from "../bonus-rules/bonus-rules.types";

/** Clause maydonlarini host qoida ustiga qo‘yib, match/sovg‘a hisobi uchun sintetik qoida. */
export function bonusRuleFromClause(host: BonusRuleRow, clause: BonusRuleClauseRow): BonusRuleRow {
  return {
    ...host,
    priority: clause.priority,
    client_category: clause.client_category,
    payment_type: clause.payment_type,
    client_type: clause.client_type,
    sales_channel: clause.sales_channel,
    price_type: clause.price_type,
    product_ids: [...clause.product_ids],
    bonus_product_ids: [...clause.bonus_product_ids],
    product_category_ids: [...clause.product_category_ids],
    scope_restrict_assortment: clause.scope_restrict_assortment,
    scope_restrict_category: clause.scope_restrict_category,
    target_all_clients: clause.target_all_clients,
    selected_client_ids: [...clause.selected_client_ids],
    in_blocks: clause.in_blocks,
    once_per_client: clause.once_per_client,
    one_plus_one_gift: clause.one_plus_one_gift,
    buy_qty: clause.buy_qty,
    free_qty: clause.free_qty,
    min_sum: clause.min_sum,
    sum_threshold_scope: clause.sum_threshold_scope,
    scope_branch_codes: [...clause.scope_branch_codes],
    scope_agent_user_ids: [...clause.scope_agent_user_ids],
    scope_trade_direction_ids: [...clause.scope_trade_direction_ids],
    conditions: clause.conditions.map((c) => ({ ...c })),
    prerequisite_rule_ids: [],
    clauses: []
  };
}

export function rewardClausesOf(rule: BonusRuleRow): BonusRuleClauseRow[] {
  const clauses = rule.clauses ?? [];
  if (clauses.length === 0) return [];
  return clauses.filter((c) => c.grants_reward);
}

/** Sovg‘a hisoblash uchun: reward clause lar yoki [host] (legacy). */
export function rewardRuleViews(rule: BonusRuleRow): BonusRuleRow[] {
  const rewards = rewardClausesOf(rule);
  if (rewards.length === 0) return [rule];
  return rewards.map((c) => bonusRuleFromClause(rule, c));
}

/** Ombor prefetch: host + barcha clause trigger/sovg‘a SKU. */
export function collectRuleStockProductIds(rules: readonly BonusRuleRow[]): Set<number> {
  const ids = new Set<number>();
  for (const r of rules) {
    for (const id of r.bonus_product_ids) if (id > 0) ids.add(id);
    for (const id of r.product_ids) if (id > 0) ids.add(id);
    for (const c of r.clauses ?? []) {
      for (const id of c.bonus_product_ids) if (id > 0) ids.add(id);
      for (const id of c.product_ids) if (id > 0) ids.add(id);
    }
  }
  return ids;
}

/** Barcha reward clause larning sovg‘a SKU lari (override/swap validatsiya). */
export function unionRewardBonusProductIds(rule: BonusRuleRow): number[] {
  const rewards = rewardClausesOf(rule);
  if (rewards.length === 0) {
    return [...new Set(rule.bonus_product_ids.filter((id) => id > 0))];
  }
  const out = new Set<number>();
  for (const c of rewards) {
    for (const id of c.bonus_product_ids) if (id > 0) out.add(id);
    if (c.bonus_product_ids.length === 0) {
      for (const id of c.product_ids) if (id > 0) out.add(id);
    }
  }
  return [...out];
}

export function ruleOrAnyClauseUsesCalendarMonth(rule: BonusRuleRow): boolean {
  if ((rule.sum_threshold_scope ?? "order") === "calendar_month") return true;
  return (rule.clauses ?? []).some((c) => (c.sum_threshold_scope ?? "order") === "calendar_month");
}
