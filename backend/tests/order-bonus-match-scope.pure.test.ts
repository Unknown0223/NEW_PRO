import { describe, expect, it } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import {
  ruleHasPurchaseScope,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  qtyRuleMatchingProductIds
} from "../src/modules/orders/order-bonus-context.match-scope";
import type { OrderAgentBonusContext, ProductLite } from "../src/modules/orders/order-bonus-context.fetch";

function rule(over: Partial<BonusRuleRow>): BonusRuleRow {
  return {
    id: 1,
    tenant_id: 1,
    name: "t",
    type: "qty",
    buy_qty: null,
    free_qty: null,
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
    product_ids: [],
    bonus_product_ids: [],
    product_category_ids: [],
    target_all_clients: true,
    selected_client_ids: [],
    is_manual: false,
    in_blocks: false,
    once_per_client: false,
    one_plus_one_gift: false,
    prerequisite_rule_ids: [],
    scope_agent_user_ids: [],
    scope_branch_codes: [],
    scope_trade_direction_ids: [],
    scope_warehouse_ids: [],
    scope_territory_refs: [],
    scope_zones: [],
    scope_regions: [],
    scope_cities: [],
    payment_method_ref: null,
    trade_direction_ref: null,
    scope_trade_direction_refs: [],
    consignment_mode: null,
    request_type_refs: [],
    source_channels: [],
    execution_type: null,
    execution_time: null,
    n_value: null,
    ...over
  };
}

describe("order-bonus-context.match-scope", () => {
  it("ruleHasPurchaseScope — product_ids bo‘sh emas", () => {
    expect(ruleHasPurchaseScope(rule({ product_ids: [1] }))).toBe(true);
    expect(ruleHasPurchaseScope(rule({ product_ids: [] }))).toBe(false);
  });

  it("ruleMatchesOrderAgentScope — filial OR agent", () => {
    const agent: OrderAgentBonusContext = { userId: 5, branch: "north", trade_direction_id: 1 };
    expect(
      ruleMatchesOrderAgentScope(
        rule({ scope_branch_codes: ["north"], scope_agent_user_ids: [99] }),
        agent
      )
    ).toBe(true);
    expect(ruleMatchesOrderAgentScope(rule({ scope_branch_codes: ["south"] }), agent)).toBe(false);
  });

  it("ruleMatchesOrderProductScope — kategoriya filtri", () => {
    const products = new Map<number, ProductLite>([[10, { id: 10, category_id: 3 }]]);
    expect(
      ruleMatchesOrderProductScope(rule({ product_category_ids: [3] }), new Set([10]), products)
    ).toBe(true);
    expect(
      ruleMatchesOrderProductScope(rule({ product_category_ids: [9] }), new Set([10]), products)
    ).toBe(false);
  });

  it("qtyRuleMatchingProductIds — faqat mos SKU", () => {
    const products = new Map<number, ProductLite>([
      [1, { id: 1, category_id: 1 }],
      [2, { id: 2, category_id: 2 }]
    ]);
    const qty = new Map<number, number>([
      [1, 5],
      [2, 0]
    ]);
    expect(qtyRuleMatchingProductIds(rule({ product_ids: [1, 2] }), qty, products)).toEqual([1]);
  });

  it("ruleMatchesClient — kategoriya va tanlangan mijoz", async () => {
    const { ruleMatchesClient } = await import("../src/modules/orders/order-bonus-context.fetch");
    const allClients = rule({ target_all_clients: true });
    expect(ruleMatchesClient(allClients, { id: 1, category: "A" })).toBe(true);
    const selected = rule({ target_all_clients: false, selected_client_ids: [7] });
    expect(ruleMatchesClient(selected, { id: 7, category: null })).toBe(true);
    expect(ruleMatchesClient(selected, { id: 8, category: null })).toBe(false);
    const catRule = rule({ target_all_clients: true, client_category: "VIP" });
    expect(ruleMatchesClient(catRule, { id: 1, category: "VIP" })).toBe(true);
    expect(ruleMatchesClient(catRule, { id: 1, category: "STD" })).toBe(false);
  });

  it("roundMoney — 2 xona yaxlitlash", async () => {
    const { Prisma } = await import("@prisma/client");
    const { roundMoney } = await import("../src/modules/orders/order-bonus-context.fetch");
    expect(roundMoney(new Prisma.Decimal("10.005")).toString()).toBe("10.01");
    expect(roundMoney(new Prisma.Decimal("10.004")).toString()).toBe("10");
  });
});

describe("phone-number value object", () => {
  it("normalize va validate", async () => {
    const { normalizePhoneNumber, isValidPhoneNumber } = await import("../src/domain/phone-number");
    expect(isValidPhoneNumber("+998 90 123 45 67")).toBe(true);
    expect(normalizePhoneNumber("+998 90 123 45 67")).toBe("998901234567");
    expect(isValidPhoneNumber("123")).toBe(false);
  });
});

describe("tenant-id value object", () => {
  it("tenantIdFrom rejects invalid", async () => {
    const { tenantIdFrom } = await import("../src/domain/tenant-id");
    expect(() => tenantIdFrom(0)).toThrow("INVALID_TENANT_ID");
    expect(tenantIdFrom(1)).toBe(1);
  });
});
