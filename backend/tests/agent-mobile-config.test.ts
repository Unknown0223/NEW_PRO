import { describe, expect, it } from "vitest";
import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  extractMobileConfigFromEntitlementsUnknown,
  parseMobileConfigV1,
  validateAgentMobileConfig
} from "../src/modules/staff/agent-mobile-config";
import { mergeAgentEntitlementsAfterProductListPatch } from "../src/modules/staff/staff.service";

describe("agent-mobile-config", () => {
  it("parseMobileConfigV1 accepts v1 client flags", () => {
    const mc = parseMobileConfigV1({
      schema_version: 1,
      client: { can_edit: true, show_balance: false, phone_prefix: "+998" }
    });
    expect(mc?.schema_version).toBe(AGENT_MOBILE_CONFIG_SCHEMA_VERSION);
    expect(mc?.client?.can_edit).toBe(true);
    expect(mc?.client?.show_balance).toBe(false);
    expect(mc?.client?.phone_prefix).toBe("+998");
  });

  it("extractMobileConfigFromEntitlementsUnknown reads nested mobile_config", () => {
    const mc = extractMobileConfigFromEntitlementsUnknown({
      price_types: ["retail"],
      mobile_config: { schema_version: 1, gps: { required_for_order: true } }
    });
    expect(mc?.gps?.required_for_order).toBe(true);
  });

  it("validateAgentMobileConfig rejects bad sync window", () => {
    expect(() =>
      validateAgentMobileConfig(1, {
        schema_version: 1,
        sync: { allowed_window_from: "25:00", allowed_window_to: "17:30" }
      })
    ).toThrow("BAD_MOBILE_CONFIG_SYNC_WINDOW");
  });

  it("validateAgentMobileConfig rejects bad disallowed payment id", () => {
    expect(() =>
      validateAgentMobileConfig(1, {
        schema_version: 1,
        misc: { disallowed_payment_method_codes: ["bad id!"] }
      })
    ).toThrow("BAD_MOBILE_CONFIG_PAYMENT_METHOD");
  });

  it("validateAgentMobileConfig rejects bad van_selling payment acceptance ids", () => {
    expect(() =>
      validateAgentMobileConfig(1, {
        schema_version: 1,
        van_selling: { payment_acceptance_method_ids: ["bad id!"] }
      })
    ).toThrow("BAD_MOBILE_CONFIG_PAYMENT_METHOD");
  });

  it("parseMobileConfigV1 reads misc QR flags", () => {
    const mc = parseMobileConfigV1({
      schema_version: 1,
      misc: {
        qr_attach_visit_page: true,
        qr_change_client_page: true
      }
    });
    expect(mc?.misc?.qr_attach_visit_page).toBe(true);
    expect(mc?.misc?.qr_change_client_page).toBe(true);
    validateAgentMobileConfig(1, mc);
  });

  it("parseMobileConfigV1 reads expeditor + order flags for field delivery", () => {
    const mc = parseMobileConfigV1({
      schema_version: 1,
      orders: {
        allow_partial_return_edit: true,
        allow_reload_from_vehicle: true,
        allow_return_from_shelf: true
      },
      client: { can_change_client_location: true },
      expeditor: {
        accept_payment_for_order: true,
        currency_symbol: "сум",
        allowed_payment_method_ids: ["pm_1", "pm_2"],
        allowed_trade_direction_ids: [3, 5],
        delivery_payment_method_strict: true,
        fingerprint_required_for_shipment_confirm: false
      },
      gps: { min_battery_pct: 15, tracking_interval_sec: 200 }
    });
    expect(mc?.orders?.allow_partial_return_edit).toBe(true);
    expect(mc?.orders?.allow_reload_from_vehicle).toBe(true);
    expect(mc?.client?.can_change_client_location).toBe(true);
    expect(mc?.expeditor?.currency_symbol).toBe("сум");
    expect(mc?.expeditor?.allowed_trade_direction_ids).toEqual([3, 5]);
    expect(mc?.gps?.min_battery_pct).toBe(15);
    validateAgentMobileConfig(1, mc);
  });

  it("mergeAgentEntitlementsAfterProductListPatch preserves mobile_config", () => {
    const userRow = {
      agent_entitlements: {
        price_types: ["a"],
        mobile_config: { schema_version: 1, client: { can_create: true } },
        product_rules: [{ category_id: 1, all: true }]
      },
      agent_price_types: ["a"],
      price_type: "a"
    };
    const out = mergeAgentEntitlementsAfterProductListPatch(userRow, {
      mode: "add",
      category_id: 2,
      product_ids: [10],
      price_types: ["b"]
    });
    expect(out.mobile_config?.client?.can_create).toBe(true);
    expect(out.price_types).toContain("b");
    expect(out.product_rules?.some((r) => r.category_id === 2)).toBe(true);
  });
});
