import { describe, expect, it } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import { ruleMatchesConsignment } from "../src/modules/orders/order-bonus-context.fetch";

function rule(mode: BonusRuleRow["consignment_mode"]): BonusRuleRow {
  return {
    id: 1,
    tenant_id: 1,
    name: "t",
    type: "discount",
    buy_qty: null,
    free_qty: null,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: 10,
    priority: 0,
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
    product_ids: [],
    bonus_product_ids: [],
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
    consignment_mode: mode,
    conditions: [],
    clauses: []
  };
}

describe("ruleMatchesConsignment", () => {
  it("all — har qanday zakaz", () => {
    expect(ruleMatchesConsignment(rule("all"), false)).toBe(true);
    expect(ruleMatchesConsignment(rule("all"), true)).toBe(true);
  });

  it("yes — faqat konsignatsiya", () => {
    expect(ruleMatchesConsignment(rule("yes"), false)).toBe(false);
    expect(ruleMatchesConsignment(rule("yes"), true)).toBe(true);
  });

  it("no — faqat oddiy zakaz", () => {
    expect(ruleMatchesConsignment(rule("no"), false)).toBe(true);
    expect(ruleMatchesConsignment(rule("no"), true)).toBe(false);
  });
});
