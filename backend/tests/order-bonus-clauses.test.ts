import { describe, expect, it } from "vitest";
import type { BonusRuleClauseRow, BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.types";
import {
  bonusRuleFromClause,
  collectRuleStockProductIds,
  rewardRuleViews,
  ruleOrAnyClauseUsesCalendarMonth,
  unionRewardBonusProductIds
} from "../src/modules/orders/order-bonus-clauses";

function hostStub(partial: Partial<BonusRuleRow> & { clauses?: BonusRuleClauseRow[] }): BonusRuleRow {
  return {
    id: 1,
    tenant_id: 1,
    name: "t",
    type: "qty",
    buy_qty: 10,
    free_qty: 1,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: null,
    priority: 1,
    is_active: true,
    valid_from: null,
    valid_to: null,
    created_at: "",
    updated_at: "",
    client_category: null,
    payment_type: null,
    client_type: null,
    sales_channel: null,
    price_type: null,
    product_ids: [1],
    bonus_product_ids: [10],
    product_category_ids: [],
    scope_restrict_assortment: false,
    scope_restrict_category: false,
    target_all_clients: true,
    selected_client_ids: [],
    is_manual: false,
    in_blocks: false,
    once_per_client: false,
    one_plus_one_gift: false,
    prerequisite_rule_ids: [],
    scope_branch_codes: [],
    scope_agent_user_ids: [],
    scope_trade_direction_ids: [],
    conditions: [],
    clauses: [],
    ...partial
  };
}

describe("order-bonus-clauses", () => {
  it("bonusRuleFromClause overlays clause fields", () => {
    const h = hostStub({
      clauses: [
        {
          id: 1,
          sort_order: 0,
          grants_reward: true,
          priority: 5,
          client_category: null,
          payment_type: null,
          client_type: null,
          sales_channel: null,
          price_type: null,
          product_ids: [2],
          bonus_product_ids: [20],
          product_category_ids: [],
          scope_restrict_assortment: false,
          scope_restrict_category: false,
          target_all_clients: true,
          selected_client_ids: [],
          in_blocks: false,
          once_per_client: false,
          one_plus_one_gift: false,
          buy_qty: 5,
          free_qty: 2,
          min_sum: null,
          sum_threshold_scope: "order",
          scope_branch_codes: [],
          scope_agent_user_ids: [],
          scope_trade_direction_ids: [],
          conditions: []
        }
      ]
    });
    const syn = bonusRuleFromClause(h, h.clauses[0]!);
    expect(syn.bonus_product_ids).toEqual([20]);
    expect(syn.buy_qty).toBe(5);
    expect(syn.clauses).toEqual([]);
  });

  it("legacy: clauses yo‘q → host", () => {
    const h = hostStub({});
    h.clauses = [];
    expect(rewardRuleViews(h)).toEqual([h]);
  });

  it("collectRuleStockProductIds includes secondary clause SKUs", () => {
    const h = hostStub({
      bonus_product_ids: [10],
      product_ids: [1],
      clauses: [
        {
          id: 1,
          sort_order: 0,
          grants_reward: true,
          priority: 1,
          client_category: null,
          payment_type: null,
          client_type: null,
          sales_channel: null,
          price_type: null,
          product_ids: [1],
          bonus_product_ids: [10],
          product_category_ids: [],
          scope_restrict_assortment: false,
          scope_restrict_category: false,
          target_all_clients: true,
          selected_client_ids: [],
          in_blocks: false,
          once_per_client: false,
          one_plus_one_gift: false,
          buy_qty: 10,
          free_qty: 1,
          min_sum: null,
          sum_threshold_scope: "order",
          scope_branch_codes: [],
          scope_agent_user_ids: [],
          scope_trade_direction_ids: [],
          conditions: []
        },
        {
          id: 2,
          sort_order: 1,
          grants_reward: true,
          priority: 1,
          client_category: null,
          payment_type: null,
          client_type: null,
          sales_channel: null,
          price_type: null,
          product_ids: [99],
          bonus_product_ids: [88],
          product_category_ids: [],
          scope_restrict_assortment: false,
          scope_restrict_category: false,
          target_all_clients: true,
          selected_client_ids: [],
          in_blocks: false,
          once_per_client: false,
          one_plus_one_gift: false,
          buy_qty: 3,
          free_qty: 1,
          min_sum: null,
          sum_threshold_scope: "calendar_month",
          scope_branch_codes: [],
          scope_agent_user_ids: [],
          scope_trade_direction_ids: [],
          conditions: []
        }
      ]
    });
    const ids = collectRuleStockProductIds([h]);
    expect(ids.has(88)).toBe(true);
    expect(ids.has(99)).toBe(true);
    expect(unionRewardBonusProductIds(h).sort()).toEqual([10, 88]);
    expect(ruleOrAnyClauseUsesCalendarMonth(h)).toBe(true);
  });
});
