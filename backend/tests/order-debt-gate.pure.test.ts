import { describe, expect, it } from "vitest";

/** Qarz balansi: balance < 0 va allow_order_with_debt=false → blok */
function shouldBlockOrderByDebt(opts: {
  allow_order_with_debt: boolean;
  balance: number;
  isInboundShelfReturn: boolean;
  isExchange: boolean;
}): boolean {
  if (opts.isInboundShelfReturn || opts.isExchange) return false;
  if (opts.allow_order_with_debt !== false) return false;
  return opts.balance < 0;
}

describe("allow_order_with_debt gate", () => {
  it("blocks when debt and flag false", () => {
    expect(
      shouldBlockOrderByDebt({
        allow_order_with_debt: false,
        balance: -1000,
        isInboundShelfReturn: false,
        isExchange: false
      })
    ).toBe(true);
  });

  it("allows when flag true even with debt", () => {
    expect(
      shouldBlockOrderByDebt({
        allow_order_with_debt: true,
        balance: -1000,
        isInboundShelfReturn: false,
        isExchange: false
      })
    ).toBe(false);
  });

  it("skips returns", () => {
    expect(
      shouldBlockOrderByDebt({
        allow_order_with_debt: false,
        balance: -1000,
        isInboundShelfReturn: true,
        isExchange: false
      })
    ).toBe(false);
  });
});

describe("consignment client gates", () => {
  function blockConsignment(opts: {
    allow_consignment: boolean;
    allow_consignment_with_debt: boolean;
    hasConsignmentDebt: boolean;
  }): "disabled" | "debt" | null {
    if (!opts.allow_consignment) return "disabled";
    if (!opts.allow_consignment_with_debt && opts.hasConsignmentDebt) return "debt";
    return null;
  }

  it("blocks all consignment when disabled", () => {
    expect(
      blockConsignment({
        allow_consignment: false,
        allow_consignment_with_debt: true,
        hasConsignmentDebt: false
      })
    ).toBe("disabled");
  });

  it("blocks when consignment debt and flag false", () => {
    expect(
      blockConsignment({
        allow_consignment: true,
        allow_consignment_with_debt: false,
        hasConsignmentDebt: true
      })
    ).toBe("debt");
  });

  it("allows consignment without debt", () => {
    expect(
      blockConsignment({
        allow_consignment: true,
        allow_consignment_with_debt: false,
        hasConsignmentDebt: false
      })
    ).toBe(null);
  });
});
