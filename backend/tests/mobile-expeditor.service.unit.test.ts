import { describe, expect, it } from "vitest";
import {
  expeditorPaymentsEnabled,
  filterExpeditorPaymentMethods,
  isPaymentCountedTowardOrderDebt
} from "../src/modules/mobile/mobile.expeditor.service";
import type { AgentMobileConfigV1 } from "../src/modules/staff/agent-mobile-config.types";

describe("mobile.expeditor.service", () => {
  it("expeditorPaymentsEnabled false when accept_payment_for_order off", () => {
    const cfg = {
      expeditor: { accept_payment_for_order: false, accept_payment_on_delivery: true }
    } as AgentMobileConfigV1;
    expect(expeditorPaymentsEnabled(cfg)).toBe(false);
  });

  it("expeditorPaymentsEnabled false when both delivery flags off", () => {
    const cfg = {
      expeditor: {
        accept_payment_for_order: true,
        accept_payment_on_delivery: false,
        accept_payment_from_debtors: false
      }
    } as AgentMobileConfigV1;
    expect(expeditorPaymentsEnabled(cfg)).toBe(false);
  });

  it("expeditorPaymentsEnabled true when on_delivery on", () => {
    const cfg = {
      expeditor: { accept_payment_for_order: true, accept_payment_on_delivery: true }
    } as AgentMobileConfigV1;
    expect(expeditorPaymentsEnabled(cfg)).toBe(true);
  });

  it("expeditorPaymentsEnabled true when only debtors on", () => {
    const cfg = {
      expeditor: {
        accept_payment_for_order: true,
        accept_payment_on_delivery: false,
        accept_payment_from_debtors: true
      }
    } as AgentMobileConfigV1;
    expect(expeditorPaymentsEnabled(cfg)).toBe(true);
  });

  it("filterExpeditorPaymentMethods returns all when allowed ids empty", () => {
    const methods = [
      { id: "m1", name: "Naqd", code: null, payment_type: "cash", currency_code: "UZS" },
      { id: "m2", name: "Karta", code: null, payment_type: "card", currency_code: "UZS" }
    ];
    expect(filterExpeditorPaymentMethods(methods, [])).toHaveLength(2);
    expect(filterExpeditorPaymentMethods(methods, undefined)).toHaveLength(2);
  });

  it("filterExpeditorPaymentMethods filters by config ids", () => {
    const methods = [
      { id: "m1", name: "Naqd", code: null, payment_type: "cash", currency_code: "UZS" },
      { id: "m2", name: "Karta", code: null, payment_type: "card", currency_code: "UZS" }
    ];
    const out = filterExpeditorPaymentMethods(methods, ["m2"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("m2");
  });

  it("isPaymentCountedTowardOrderDebt ignores pending and rejected", () => {
    expect(isPaymentCountedTowardOrderDebt("confirmed")).toBe(true);
    expect(isPaymentCountedTowardOrderDebt("pending_confirmation")).toBe(false);
    expect(isPaymentCountedTowardOrderDebt("rejected")).toBe(false);
    expect(isPaymentCountedTowardOrderDebt(null)).toBe(true);
  });
});
