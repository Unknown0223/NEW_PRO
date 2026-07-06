import type { BonusConditionRow, BonusRuleRow } from "./bonus-rules.types";

/** Zakazda saqlanadigan qoida snapshot (tahrirdan keyin ham ko‘rinadi). */
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
  client_category: string | null;
  payment_type: string | null;
  client_type: string | null;
  sales_channel: string | null;
  price_type: string | null;
  product_ids: number[];
  bonus_product_ids: number[];
  product_category_ids: number[];
  scope_restrict_assortment: boolean;
  scope_restrict_category: boolean;
  target_all_clients: boolean;
  selected_client_ids: number[];
  is_manual: boolean;
  in_blocks: boolean;
  once_per_client: boolean;
  one_plus_one_gift: boolean;
  prerequisite_rule_ids: number[];
  scope_branch_codes: string[];
  scope_agent_user_ids: number[];
  scope_trade_direction_ids: number[];
  conditions: BonusConditionRow[];
  captured_at: string;
};

export function buildBonusRuleApplySnapshot(rule: BonusRuleRow): AppliedBonusRuleSnapshot {
  return {
    rule_id: rule.id,
    name: rule.name,
    type: rule.type,
    buy_qty: rule.buy_qty,
    free_qty: rule.free_qty,
    min_sum: rule.min_sum,
    sum_threshold_scope: rule.sum_threshold_scope ?? "order",
    discount_pct: rule.discount_pct,
    priority: rule.priority,
    client_category: rule.client_category,
    payment_type: rule.payment_type,
    client_type: rule.client_type,
    sales_channel: rule.sales_channel,
    price_type: rule.price_type,
    product_ids: [...rule.product_ids],
    bonus_product_ids: [...rule.bonus_product_ids],
    product_category_ids: [...rule.product_category_ids],
    scope_restrict_assortment: rule.scope_restrict_assortment ?? false,
    scope_restrict_category: rule.scope_restrict_category ?? false,
    target_all_clients: rule.target_all_clients,
    selected_client_ids: [...rule.selected_client_ids],
    is_manual: rule.is_manual,
    in_blocks: rule.in_blocks,
    once_per_client: rule.once_per_client,
    one_plus_one_gift: rule.one_plus_one_gift,
    prerequisite_rule_ids: [...(rule.prerequisite_rule_ids ?? [])],
    scope_branch_codes: [...(rule.scope_branch_codes ?? [])],
    scope_agent_user_ids: [...(rule.scope_agent_user_ids ?? [])],
    scope_trade_direction_ids: [...(rule.scope_trade_direction_ids ?? [])],
    conditions: rule.conditions.map((c) => ({ ...c })),
    captured_at: new Date().toISOString()
  };
}

export function parseAppliedBonusRulesSnapshot(raw: unknown): AppliedBonusRuleSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: AppliedBonusRuleSnapshot[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const ruleId = Number(o.rule_id);
    if (!Number.isInteger(ruleId) || ruleId < 1) continue;
    if (typeof o.name !== "string" || typeof o.type !== "string") continue;
    out.push({
      rule_id: ruleId,
      name: o.name,
      type: o.type,
      buy_qty: o.buy_qty != null ? Number(o.buy_qty) : null,
      free_qty: o.free_qty != null ? Number(o.free_qty) : null,
      min_sum: o.min_sum != null ? Number(o.min_sum) : null,
      sum_threshold_scope:
        o.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
      discount_pct: o.discount_pct != null ? Number(o.discount_pct) : null,
      priority: Number(o.priority) || 0,
      client_category: typeof o.client_category === "string" ? o.client_category : null,
      payment_type: typeof o.payment_type === "string" ? o.payment_type : null,
      client_type: typeof o.client_type === "string" ? o.client_type : null,
      sales_channel: typeof o.sales_channel === "string" ? o.sales_channel : null,
      price_type: typeof o.price_type === "string" ? o.price_type : null,
      product_ids: Array.isArray(o.product_ids)
        ? o.product_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      bonus_product_ids: Array.isArray(o.bonus_product_ids)
        ? o.bonus_product_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      product_category_ids: Array.isArray(o.product_category_ids)
        ? o.product_category_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      scope_restrict_assortment: Boolean(o.scope_restrict_assortment),
      scope_restrict_category: Boolean(o.scope_restrict_category),
      target_all_clients: o.target_all_clients !== false,
      selected_client_ids: Array.isArray(o.selected_client_ids)
        ? o.selected_client_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      is_manual: Boolean(o.is_manual),
      in_blocks: Boolean(o.in_blocks),
      once_per_client: Boolean(o.once_per_client),
      one_plus_one_gift: Boolean(o.one_plus_one_gift),
      prerequisite_rule_ids: Array.isArray(o.prerequisite_rule_ids)
        ? o.prerequisite_rule_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      scope_branch_codes: Array.isArray(o.scope_branch_codes)
        ? o.scope_branch_codes.map((s) => String(s).trim()).filter(Boolean)
        : [],
      scope_agent_user_ids: Array.isArray(o.scope_agent_user_ids)
        ? o.scope_agent_user_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      scope_trade_direction_ids: Array.isArray(o.scope_trade_direction_ids)
        ? o.scope_trade_direction_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      conditions: Array.isArray(o.conditions)
        ? (o.conditions as AppliedBonusRuleSnapshot["conditions"])
        : [],
      captured_at: typeof o.captured_at === "string" ? o.captured_at : new Date(0).toISOString()
    });
  }
  return out;
}
