import type {
  BonusConditionInput,
  BonusConditionRow,
  BonusRuleClauseInput,
  BonusRuleClauseRow
} from "./bonus-rules.types";
import { validateAutoBonusProductScope, validateConditions, validateForType } from "./bonus-rules.validate";

function normalizeScopeBranchCodes(codes: readonly string[] | undefined): string[] {
  const out = new Set<string>();
  for (const c of codes ?? []) {
    const t = String(c).trim();
    if (t) out.add(t);
  }
  return [...out].sort((a, b) => a.localeCompare(b, "ru"));
}

function normalizeScopePositiveIds(ids: readonly number[] | undefined): number[] {
  return [...new Set((ids ?? []).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

export function isGiftBonusType(type: string, discountPct?: number | null): boolean {
  if (type === "qty") return true;
  if (type === "sum" && (discountPct == null || Number(discountPct) <= 0)) return true;
  return false;
}

export function validateClausesForGiftBonus(
  type: string,
  clauses: BonusRuleClauseInput[] | undefined,
  discountPct?: number | null
): BonusRuleClauseInput[] {
  if (!isGiftBonusType(type, discountPct)) {
    return [];
  }
  if (!clauses || clauses.length === 0) {
    throw new Error("CLAUSES_REQUIRED");
  }

  const rewardClauses = clauses.filter((c) => c.grants_reward !== false);
  if (rewardClauses.length === 0) {
    throw new Error("CLAUSE_REWARD_REQUIRED");
  }

  for (const c of clauses) {
    const grants = c.grants_reward !== false;
    validateAutoBonusProductScope(
      type,
      false,
      c.product_ids ?? [],
      c.product_category_ids ?? [],
      c.scope_restrict_assortment,
      c.scope_restrict_category
    );

    if (grants) {
      const bonusIds = (c.bonus_product_ids ?? []).filter((n) => n > 0);
      const assortmentOnly = c.scope_restrict_assortment === true && c.scope_restrict_category !== true;
      if (!assortmentOnly && bonusIds.length === 0 && !(c.product_ids ?? []).length) {
        throw new Error("CLAUSE_BONUS_PRODUCTS_REQUIRED");
      }
      if (type === "qty") {
        const conds = normalizeClauseConditions(c);
        validateForType(
          "qty",
          { buy_qty: c.buy_qty, free_qty: c.free_qty, min_sum: null, discount_pct: null },
          conds,
          Boolean(c.one_plus_one_gift)
        );
        if (conds?.length) validateConditions(conds);
      }
      if (type === "sum") {
        validateForType(
          "sum",
          { buy_qty: null, free_qty: null, min_sum: c.min_sum, discount_pct: null },
          undefined,
          false
        );
      }
    } else if (type === "qty") {
      const conds = normalizeClauseConditions(c);
      if (conds?.length) validateConditions(conds);
      else if (c.buy_qty == null || c.buy_qty < 1) {
        // Gate qty: kamida step yoki buy_qty kerak
        if (!c.one_plus_one_gift) throw new Error("VALIDATION");
      }
    } else if (type === "sum") {
      if (c.min_sum == null || c.min_sum < 0) throw new Error("VALIDATION");
    }
  }

  return clauses;
}

export function normalizeClauseConditions(c: BonusRuleClauseInput): BonusConditionInput[] | undefined {
  if (c.one_plus_one_gift && (!c.conditions || c.conditions.length === 0)) {
    return [{ step_qty: 1, bonus_qty: 1, sort_order: 0 }];
  }
  if (c.conditions && c.conditions.length > 0) return c.conditions;
  if (c.buy_qty != null && c.free_qty != null) {
    return [{ step_qty: c.buy_qty, bonus_qty: c.free_qty, sort_order: 0 }];
  }
  return undefined;
}

/** Flat API maydonlaridan bitta asosiy clause (eski clientlar). */
export function synthesizePrimaryClauseFromFlat(input: {
  type: string;
  priority?: number;
  client_category?: string | null;
  payment_type?: string | null;
  client_type?: string | null;
  sales_channel?: string | null;
  price_type?: string | null;
  product_ids?: number[];
  bonus_product_ids?: number[];
  product_category_ids?: number[];
  scope_restrict_assortment?: boolean;
  scope_restrict_category?: boolean;
  target_all_clients?: boolean;
  selected_client_ids?: number[];
  in_blocks?: boolean;
  once_per_client?: boolean;
  one_plus_one_gift?: boolean;
  buy_qty?: number | null;
  free_qty?: number | null;
  min_sum?: number | null;
  sum_threshold_scope?: "order" | "calendar_month";
  scope_branch_codes?: string[];
  scope_agent_user_ids?: number[];
  scope_trade_direction_ids?: number[];
  conditions?: BonusConditionInput[];
}): BonusRuleClauseInput {
  return {
    sort_order: 0,
    grants_reward: true,
    priority: input.priority ?? 0,
    client_category: input.client_category ?? null,
    payment_type: input.payment_type ?? null,
    client_type: input.client_type ?? null,
    sales_channel: input.sales_channel ?? null,
    price_type: input.price_type ?? null,
    product_ids: input.product_ids ?? [],
    bonus_product_ids: input.bonus_product_ids ?? [],
    product_category_ids: input.product_category_ids ?? [],
    scope_restrict_assortment: input.scope_restrict_assortment ?? false,
    scope_restrict_category: input.scope_restrict_category ?? false,
    target_all_clients: input.target_all_clients ?? true,
    selected_client_ids: input.selected_client_ids ?? [],
    in_blocks: input.in_blocks ?? true,
    once_per_client: input.once_per_client ?? false,
    one_plus_one_gift: input.one_plus_one_gift ?? false,
    buy_qty: input.buy_qty ?? null,
    free_qty: input.free_qty ?? null,
    min_sum: input.min_sum ?? null,
    sum_threshold_scope: input.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    scope_branch_codes: input.scope_branch_codes ?? [],
    scope_agent_user_ids: input.scope_agent_user_ids ?? [],
    scope_trade_direction_ids: input.scope_trade_direction_ids ?? [],
    conditions: input.conditions
  };
}

export function primaryRewardClause(clauses: BonusRuleClauseInput[]): BonusRuleClauseInput {
  const sorted = [...clauses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return sorted.find((c) => c.grants_reward !== false) ?? sorted[0]!;
}

export function clauseScalarData(c: BonusRuleClauseInput, index: number) {
  const allClients = c.target_all_clients ?? true;
  const conds = normalizeClauseConditions(c);
  const buy =
    conds && conds.length > 0 ? Math.floor(conds[0]!.step_qty) : (c.buy_qty ?? null);
  const free =
    conds && conds.length > 0 ? Math.floor(conds[0]!.bonus_qty) : (c.free_qty ?? null);
  return {
    sort_order: c.sort_order ?? index,
    grants_reward: c.grants_reward !== false,
    priority: c.priority ?? 0,
    client_category: c.client_category?.trim() || null,
    payment_type: c.payment_type?.trim() || null,
    client_type: c.client_type?.trim() || null,
    sales_channel: c.sales_channel?.trim() || null,
    price_type: c.price_type?.trim() || null,
    product_ids: c.product_ids ?? [],
    bonus_product_ids: c.grants_reward === false ? [] : (c.bonus_product_ids ?? []),
    product_category_ids: c.product_category_ids ?? [],
    scope_restrict_assortment: c.scope_restrict_assortment ?? false,
    scope_restrict_category: c.scope_restrict_category ?? false,
    target_all_clients: allClients,
    selected_client_ids: allClients ? [] : (c.selected_client_ids ?? []),
    in_blocks: c.in_blocks ?? true,
    once_per_client: c.once_per_client ?? false,
    one_plus_one_gift: c.one_plus_one_gift ?? false,
    buy_qty: buy,
    free_qty: free,
    min_sum: c.min_sum ?? null,
    sum_threshold_scope: c.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    scope_branch_codes: normalizeScopeBranchCodes(c.scope_branch_codes ?? []),
    scope_agent_user_ids: normalizeScopePositiveIds(c.scope_agent_user_ids ?? []),
    scope_trade_direction_ids: normalizeScopePositiveIds(c.scope_trade_direction_ids ?? []),
    conditions: conds
  };
}

/** Flat create payload for clause + nested conditions. */
export function clauseCreateData(
  bonusRuleId: number,
  c: BonusRuleClauseInput,
  index: number
): Record<string, unknown> {
  const { conditions: conds, ...scalars } = clauseScalarData(c, index);
  return {
    bonus_rule_id: bonusRuleId,
    ...scalars,
    conditions:
      conds && conds.length > 0
        ? {
            create: conds.map((row, i) => ({
              bonus_rule_id: bonusRuleId,
              min_qty: row.min_qty ?? null,
              max_qty: row.max_qty ?? null,
              step_qty: row.step_qty,
              bonus_qty: row.bonus_qty,
              max_bonus_qty: row.max_bonus_qty ?? null,
              sort_order: row.sort_order ?? i
            }))
          }
        : undefined
  };
}

export function mapClauseRow(c: {
  id: number;
  sort_order: number;
  grants_reward: boolean;
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
  in_blocks: boolean;
  once_per_client: boolean;
  one_plus_one_gift: boolean;
  buy_qty: number | null;
  free_qty: number | null;
  min_sum: unknown;
  sum_threshold_scope: string;
  scope_branch_codes: string[];
  scope_agent_user_ids: number[];
  scope_trade_direction_ids: number[];
  conditions?: Array<{
    id: number;
    min_qty: unknown;
    max_qty: unknown;
    step_qty: unknown;
    bonus_qty: unknown;
    max_bonus_qty: unknown;
    sort_order: number;
  }>;
}): BonusRuleClauseRow {
  const conditions: BonusConditionRow[] = (c.conditions ?? []).map((row) => ({
    id: row.id,
    min_qty: row.min_qty != null ? Number(row.min_qty) : null,
    max_qty: row.max_qty != null ? Number(row.max_qty) : null,
    step_qty: Number(row.step_qty),
    bonus_qty: Number(row.bonus_qty),
    max_bonus_qty: row.max_bonus_qty != null ? Number(row.max_bonus_qty) : null,
    sort_order: row.sort_order
  }));
  return {
    id: c.id,
    sort_order: c.sort_order,
    grants_reward: c.grants_reward,
    priority: c.priority,
    client_category: c.client_category,
    payment_type: c.payment_type,
    client_type: c.client_type,
    sales_channel: c.sales_channel,
    price_type: c.price_type,
    product_ids: [...c.product_ids],
    bonus_product_ids: [...c.bonus_product_ids],
    product_category_ids: [...c.product_category_ids],
    scope_restrict_assortment: c.scope_restrict_assortment,
    scope_restrict_category: c.scope_restrict_category,
    target_all_clients: c.target_all_clients,
    selected_client_ids: [...c.selected_client_ids],
    in_blocks: c.in_blocks,
    once_per_client: c.once_per_client,
    one_plus_one_gift: c.one_plus_one_gift,
    buy_qty: c.buy_qty,
    free_qty: c.free_qty,
    min_sum: c.min_sum != null ? Number(c.min_sum) : null,
    sum_threshold_scope: c.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    scope_branch_codes: normalizeScopeBranchCodes(c.scope_branch_codes ?? []),
    scope_agent_user_ids: normalizeScopePositiveIds(c.scope_agent_user_ids ?? []),
    scope_trade_direction_ids: normalizeScopePositiveIds(c.scope_trade_direction_ids ?? []),
    conditions
  };
}
