import { describe, expect, it } from "vitest";
import type { AgentMobileConfigV1 } from "../src/modules/staff/agent-mobile-config.types";
import {
  validateShipmentDateRequired
} from "../src/modules/mobile/mobile-order-policy";

describe("mobile-order-policy", () => {
  it("validateShipmentDateRequired skips when config off", () => {
    const cfg = { misc: { require_shipment_date: false } } as AgentMobileConfigV1;
    expect(() => validateShipmentDateRequired(cfg, null)).not.toThrow();
  });

  it("validateShipmentDateRequired throws when required and missing", () => {
    const cfg = { misc: { require_shipment_date: true } } as AgentMobileConfigV1;
    expect(() => validateShipmentDateRequired(cfg, "")).toThrow("SHIPMENT_DATE_REQUIRED");
  });

  it("validateShipmentDateRequired accepts ISO date", () => {
    const cfg = { misc: { require_shipment_date: true } } as AgentMobileConfigV1;
    expect(() => validateShipmentDateRequired(cfg, "2026-06-26")).not.toThrow();
  });
});
