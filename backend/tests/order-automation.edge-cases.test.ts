import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  autoConfirmRuleMatchesContext,
  buildOrderRuleContextFromParts,
  computeAutoConfirmRunAt,
  ruleMatchesOrderContext
} from "../src/modules/order-automation/order-automation.engine";
import type { OrderRuleContext } from "../src/modules/order-automation/order-automation.types";

function baseCtx(over: Partial<OrderRuleContext> = {}): OrderRuleContext {
  return {
    tenant_id: 1,
    total_sum: 5_000_000,
    currency_code: "UZS",
    warehouse_id: 10,
    agent_id: 5,
    agent_trade_direction: "Продажа",
    payment_method_ref: "cash",
    request_type_ref: "order",
    is_consignment: false,
    order_type: "order",
    creation_channel: "web",
    client_region: "Ташкент",
    client_city: "Ташкент",
    client_zone: null,
    client_territory_refs: ["Ташкент"],
    ...over
  };
}

function baseRule() {
  return {
    is_active: true,
    currency_code: "UZS",
    amount_from: null,
    amount_to: null,
    scope_agent_user_ids: [] as number[],
    scope_warehouse_ids: [] as number[],
    scope_territory_refs: [] as string[],
    scope_zones: [] as string[],
    scope_regions: [] as string[],
    scope_cities: [] as string[],
    payment_method_ref: null,
    trade_direction_ref: null,
    consignment_mode: "all"
  };
}

describe("order automation edge cases", () => {
  it("inactive rule never matches", () => {
    expect(ruleMatchesOrderContext({ ...baseRule(), is_active: false }, baseCtx())).toBe(false);
  });

  it("currency mismatch blocks", () => {
    expect(
      ruleMatchesOrderContext({ ...baseRule(), currency_code: "USD" }, baseCtx({ currency_code: "UZS" }))
    ).toBe(false);
  });

  it("null agent fails scoped agent rule", () => {
    expect(
      ruleMatchesOrderContext({ ...baseRule(), scope_agent_user_ids: [1] }, baseCtx({ agent_id: null }))
    ).toBe(false);
  });

  it("amount_to boundary inclusive", () => {
    expect(
      ruleMatchesOrderContext(
        { ...baseRule(), amount_from: 100, amount_to: 5_000_000 },
        baseCtx({ total_sum: 5_000_000 })
      )
    ).toBe(true);
    expect(
      ruleMatchesOrderContext(
        { ...baseRule(), amount_from: 100, amount_to: 4_999_999 },
        baseCtx({ total_sum: 5_000_000 })
      )
    ).toBe(false);
  });

  it("warehouse scope empty means all warehouses", () => {
    expect(
      ruleMatchesOrderContext({ ...baseRule(), scope_warehouse_ids: [] }, baseCtx({ warehouse_id: 999 }))
    ).toBe(true);
  });

  it("autoConfirm rejects unknown request type", () => {
    const rule = {
      ...baseRule(),
      request_type_refs: ["return"],
      source_channels: ["web"],
      execution_type: "instant",
      execution_time: null,
      n_value: null
    };
    expect(autoConfirmRuleMatchesContext(rule as never, baseCtx({ request_type_ref: "order" }))).toBe(false);
  });

  it("computeAutoConfirmRunAt with n business days on weekend start", () => {
    const sat = new Date("2026-06-06T12:00:00Z");
    const run = addBusinessDays(sat, 1);
    expect(run.getDay()).not.toBe(0);
    expect(run.getDay()).not.toBe(6);
  });

  it("buildOrderRuleContextFromParts collects territory refs", () => {
    const ctx = buildOrderRuleContextFromParts({
      tenant_id: 1,
      total_sum: 1,
      warehouse_id: 1,
      agent_id: 1,
      agent_trade_direction: null,
      payment_method_ref: null,
      request_type_ref: null,
      is_consignment: false,
      order_type: "order",
      client_region: "R1",
      client_city: "C2",
      client_zone: "Z3"
    });
    expect(ctx.client_territory_refs.length).toBeGreaterThanOrEqual(2);
    expect(ctx.client_territory_refs).toContain("R1");
    expect(ctx.client_territory_refs).toContain("C2");
  });

  it("instant auto-confirm runAt is near now", () => {
    const before = Date.now();
    const run = computeAutoConfirmRunAt(
      { execution_type: "instant", execution_time: null, n_value: null },
      new Date()
    );
    expect(run.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(run.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });
});
