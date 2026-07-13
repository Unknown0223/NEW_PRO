import type { BonusRuleClauseRow, BonusRuleRow } from "./bonus-rule-types";

export type CondForm = {
  min_qty: string;
  max_qty: string;
  step_qty: string;
  bonus_qty: string;
  max_bonus_qty: string;
};

export type ClauseFormState = {
  key: string;
  grantsReward: boolean;
  priority: string;
  clientCategory: string;
  paymentType: string;
  clientType: string;
  salesChannel: string;
  priceType: string;
  triggerProductIds: number[];
  bonusProductIds: number[];
  selectedCategoryIds: number[];
  targetAllClients: boolean;
  selectedClientIds: number[];
  selectedClientNames: Record<number, string>;
  sumThresholdScope: "order" | "calendar_month";
  inBlocks: boolean;
  oncePerClient: boolean;
  onlyByAssortment: boolean;
  onlyByCategory: boolean;
  minSum: string;
  conditions: CondForm[];
  scopeBranchCodes: string[];
  scopeAgentUserIds: number[];
  scopeTradeDirectionIds: number[];
};

export function emptyCond(): CondForm {
  return { min_qty: "", max_qty: "", step_qty: "6", bonus_qty: "1", max_bonus_qty: "" };
}

let clauseKeySeq = 1;
export function nextClauseKey(): string {
  return `c-${clauseKeySeq++}-${Date.now()}`;
}

export function emptyClauseForm(grantsReward = true): ClauseFormState {
  return {
    key: nextClauseKey(),
    grantsReward,
    priority: "10",
    clientCategory: "",
    paymentType: "",
    clientType: "",
    salesChannel: "",
    priceType: "",
    triggerProductIds: [],
    bonusProductIds: [],
    selectedCategoryIds: [],
    targetAllClients: true,
    selectedClientIds: [],
    selectedClientNames: {},
    sumThresholdScope: "order",
    inBlocks: true,
    oncePerClient: false,
    onlyByAssortment: false,
    onlyByCategory: false,
    minSum: "",
    conditions: [emptyCond()],
    scopeBranchCodes: [],
    scopeAgentUserIds: [],
    scopeTradeDirectionIds: []
  };
}

export function clauseFromRuleFlat(rule: BonusRuleRow): ClauseFormState {
  const hasScopeFlags =
    rule.scope_restrict_assortment === true || rule.scope_restrict_category === true;
  const pids = [...(rule.product_ids ?? [])];
  const cids = [...(rule.product_category_ids ?? [])];
  return {
    key: nextClauseKey(),
    grantsReward: true,
    priority: String(rule.priority ?? 0),
    clientCategory: rule.client_category ?? "",
    paymentType: rule.payment_type ?? "",
    clientType: rule.client_type ?? "",
    salesChannel: rule.sales_channel ?? "",
    priceType: rule.price_type ?? "",
    triggerProductIds: pids,
    bonusProductIds: [...(rule.bonus_product_ids ?? [])],
    selectedCategoryIds: cids,
    targetAllClients: rule.target_all_clients ?? true,
    selectedClientIds: [...(rule.selected_client_ids ?? [])],
    selectedClientNames: {},
    sumThresholdScope: rule.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    inBlocks: rule.in_blocks ?? true,
    oncePerClient: rule.once_per_client ?? false,
    onlyByAssortment: hasScopeFlags
      ? rule.scope_restrict_assortment === true
      : !cids.length && pids.length > 0,
    onlyByCategory: hasScopeFlags ? rule.scope_restrict_category === true : cids.length > 0,
    minSum: rule.min_sum != null ? String(rule.min_sum) : "",
    conditions: rule.conditions?.length
      ? rule.conditions.map((c) => ({
          min_qty: c.min_qty != null ? String(c.min_qty) : "",
          max_qty: c.max_qty != null ? String(c.max_qty) : "",
          step_qty: String(c.step_qty),
          bonus_qty: String(c.bonus_qty),
          max_bonus_qty: c.max_bonus_qty != null ? String(c.max_bonus_qty) : ""
        }))
      : [
          {
            min_qty: "",
            max_qty: "",
            step_qty: String(rule.buy_qty ?? 6),
            bonus_qty: String(rule.free_qty ?? 1),
            max_bonus_qty: ""
          }
        ],
    scopeBranchCodes: [...(rule.scope_branch_codes ?? [])],
    scopeAgentUserIds: [...(rule.scope_agent_user_ids ?? [])],
    scopeTradeDirectionIds: [...(rule.scope_trade_direction_ids ?? [])]
  };
}

export function clauseFromApiRow(c: BonusRuleClauseRow): ClauseFormState {
  const hasScopeFlags =
    c.scope_restrict_assortment === true || c.scope_restrict_category === true;
  const pids = [...(c.product_ids ?? [])];
  const cids = [...(c.product_category_ids ?? [])];
  return {
    key: nextClauseKey(),
    grantsReward: c.grants_reward !== false,
    priority: String(c.priority ?? 0),
    clientCategory: c.client_category ?? "",
    paymentType: c.payment_type ?? "",
    clientType: c.client_type ?? "",
    salesChannel: c.sales_channel ?? "",
    priceType: c.price_type ?? "",
    triggerProductIds: pids,
    bonusProductIds: [...(c.bonus_product_ids ?? [])],
    selectedCategoryIds: cids,
    targetAllClients: c.target_all_clients ?? true,
    selectedClientIds: [...(c.selected_client_ids ?? [])],
    selectedClientNames: {},
    sumThresholdScope: c.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    inBlocks: c.in_blocks ?? true,
    oncePerClient: c.once_per_client ?? false,
    onlyByAssortment: hasScopeFlags
      ? c.scope_restrict_assortment === true
      : !cids.length && pids.length > 0,
    onlyByCategory: hasScopeFlags ? c.scope_restrict_category === true : cids.length > 0,
    minSum: c.min_sum != null ? String(c.min_sum) : "",
    conditions: c.conditions?.length
      ? c.conditions.map((row) => ({
          min_qty: row.min_qty != null ? String(row.min_qty) : "",
          max_qty: row.max_qty != null ? String(row.max_qty) : "",
          step_qty: String(row.step_qty),
          bonus_qty: String(row.bonus_qty),
          max_bonus_qty: row.max_bonus_qty != null ? String(row.max_bonus_qty) : ""
        }))
      : [emptyCond()],
    scopeBranchCodes: [...(c.scope_branch_codes ?? [])],
    scopeAgentUserIds: [...(c.scope_agent_user_ids ?? [])],
    scopeTradeDirectionIds: [...(c.scope_trade_direction_ids ?? [])]
  };
}

export function parseCondRow(c: CondForm) {
  return {
    min_qty: c.min_qty.trim() === "" ? null : Number.parseFloat(c.min_qty),
    max_qty: c.max_qty.trim() === "" ? null : Number.parseFloat(c.max_qty),
    step_qty: Number.parseFloat(c.step_qty),
    bonus_qty: Number.parseFloat(c.bonus_qty),
    max_bonus_qty: c.max_bonus_qty.trim() === "" ? null : Number.parseFloat(c.max_bonus_qty)
  };
}

export function clauseFormToApiPayload(
  c: ClauseFormState,
  type: string,
  index: number
): Record<string, unknown> {
  const product_ids = c.onlyByAssortment || c.onlyByCategory ? c.triggerProductIds : [];
  const product_category_ids = c.onlyByCategory ? c.selectedCategoryIds : [];
  const assortmentOnlyNoBonusPicker = c.onlyByAssortment && !c.onlyByCategory;
  const bonus_product_ids =
    !c.grantsReward
      ? []
      : assortmentOnlyNoBonusPicker && (type === "qty" || type === "sum")
        ? []
        : c.bonusProductIds;

  const base: Record<string, unknown> = {
    sort_order: index,
    grants_reward: c.grantsReward,
    priority: Number.parseInt(c.priority, 10) || 0,
    client_category: c.clientCategory.trim() || null,
    payment_type: c.paymentType.trim() || null,
    client_type: c.clientType.trim() || null,
    sales_channel: c.salesChannel.trim() || null,
    price_type: c.priceType.trim() || null,
    product_ids,
    bonus_product_ids,
    product_category_ids,
    scope_restrict_assortment: c.onlyByAssortment,
    scope_restrict_category: c.onlyByCategory,
    target_all_clients: c.targetAllClients,
    selected_client_ids: c.targetAllClients ? [] : c.selectedClientIds,
    in_blocks: c.inBlocks,
    once_per_client: c.oncePerClient,
    one_plus_one_gift: false,
    sum_threshold_scope: c.sumThresholdScope,
    scope_branch_codes: c.scopeBranchCodes,
    scope_agent_user_ids: c.scopeAgentUserIds,
    scope_trade_direction_ids: c.scopeTradeDirectionIds
  };

  if (type === "qty") {
    const rows = c.conditions.map(parseCondRow);
    base.conditions = rows.map((r, i) => ({ ...r, sort_order: i }));
    base.buy_qty = Math.floor(rows[0]?.step_qty ?? 0);
    base.free_qty = Math.floor(rows[0]?.bonus_qty ?? 0);
    base.min_sum = null;
  } else {
    base.min_sum = Number.parseFloat(c.minSum);
    base.buy_qty = null;
    base.free_qty = c.grantsReward ? 1 : null;
    base.conditions = [];
  }
  return base;
}
