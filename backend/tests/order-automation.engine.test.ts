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

describe("ruleMatchesOrderContext", () => {
  it("matches when scopes empty", () => {
    expect(ruleMatchesOrderContext(baseRule(), baseCtx())).toBe(true);
  });

  it("blocks by amount range", () => {
    expect(
      ruleMatchesOrderContext(
        { ...baseRule(), amount_from: 10_000_000 },
        baseCtx({ total_sum: 5_000_000 })
      )
    ).toBe(false);
    expect(
      ruleMatchesOrderContext(
        { ...baseRule(), amount_from: 1_000_000, amount_to: 6_000_000 },
        baseCtx({ total_sum: 5_000_000 })
      )
    ).toBe(true);
  });

  it("requires agent when scoped", () => {
    expect(
      ruleMatchesOrderContext({ ...baseRule(), scope_agent_user_ids: [99] }, baseCtx({ agent_id: 5 }))
    ).toBe(false);
    expect(
      ruleMatchesOrderContext({ ...baseRule(), scope_agent_user_ids: [5] }, baseCtx({ agent_id: 5 }))
    ).toBe(true);
  });

  it("matches any of several trade directions", () => {
    expect(
      ruleMatchesOrderContext(
        {
          ...baseRule(),
          scope_trade_direction_refs: ["UMUMIY", "FV"],
          trade_direction_ref: null
        },
        baseCtx({ agent_trade_direction: "UMUMIY" })
      )
    ).toBe(true);
    expect(
      ruleMatchesOrderContext(
        {
          ...baseRule(),
          scope_trade_direction_refs: ["UMUMIY", "FV"],
          trade_direction_ref: null
        },
        baseCtx({ agent_trade_direction: "BOSHQA" })
      )
    ).toBe(false);
  });

  it("consignment mode yes/no", () => {
    expect(
      ruleMatchesOrderContext({ ...baseRule(), consignment_mode: "yes" }, baseCtx({ is_consignment: false }))
    ).toBe(false);
    expect(
      ruleMatchesOrderContext({ ...baseRule(), consignment_mode: "yes" }, baseCtx({ is_consignment: true }))
    ).toBe(true);
  });
});

describe("autoConfirmRuleMatchesContext", () => {
  it("filters request type and channel", () => {
    const rule = {
      ...baseRule(),
      request_type_refs: ["order"],
      source_channels: ["web"],
      execution_type: "instant",
      execution_time: null,
      n_value: null
    };
    expect(autoConfirmRuleMatchesContext(rule as never, baseCtx())).toBe(true);
    expect(
      autoConfirmRuleMatchesContext(rule as never, baseCtx({ creation_channel: "mobile" }))
    ).toBe(false);
  });
});

describe("computeAutoConfirmRunAt", () => {
  it("instant is now-ish", () => {
    const now = new Date("2026-05-27T10:00:00Z");
    const run = computeAutoConfirmRunAt(
      { execution_type: "instant", execution_time: null, n_value: null },
      now
    );
    expect(run.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("adds business days skipping weekends", () => {
    const fri = new Date("2026-05-29T12:00:00Z");
    const run = addBusinessDays(fri, 1);
    expect(run.getTime()).toBeGreaterThan(fri.getTime());
    expect(run.getDay()).not.toBe(0);
    expect(run.getDay()).not.toBe(6);
  });
});

describe("buildOrderRuleContextFromParts", () => {
  it("collects territory refs", () => {
    const ctx = buildOrderRuleContextFromParts({
      tenant_id: 1,
      total_sum: 100,
      warehouse_id: 1,
      agent_id: null,
      agent_trade_direction: null,
      payment_method_ref: null,
      request_type_ref: null,
      is_consignment: false,
      order_type: "order",
      client_region: "R1",
      client_city: "C1",
      client_zone: null
    });
    expect(ctx.client_territory_refs).toContain("R1");
    expect(ctx.client_territory_refs).toContain("C1");
  });
});
