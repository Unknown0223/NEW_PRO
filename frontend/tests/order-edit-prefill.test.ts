import { describe, expect, it } from "vitest";
import { countPositiveQtyEntries, resolveLockedOrderAgentId } from "@/components/orders/order-create/order-edit-header";
import {
  matchPaymentMethodSelectId,
  paymentMethodIdForPriceType,
  resolvePriceTypeFromOrder
} from "@/components/orders/order-create/view/polki-shelf-return/polki-apply-order-defaults";

const priceOptions = [
  { key: "NAXT", label: "Naqt" },
  { key: "TERM", label: "Terminal" },
  { key: "NAXT_B", label: "Naqt_B" }
];

const priceEntries = [
  {
    id: "pt-naxt",
    name: "Naqt",
    code: "NAXT",
    payment_method_id: "pm-nal",
    kind: "sale" as const,
    active: true
  },
  {
    id: "pt-term",
    name: "Terminal",
    code: "TERM",
    payment_method_id: "pm-term",
    kind: "sale" as const,
    active: true
  }
];

describe("resolvePriceTypeFromOrder", () => {
  it("maps stored payment method id to linked price type key", () => {
    expect(
      resolvePriceTypeFromOrder(
        { payment_method_ref: "pm-nal", price_type: null },
        priceOptions,
        priceEntries
      )
    ).toBe("NAXT");
  });

  it("maps display label to catalog key", () => {
    expect(
      resolvePriceTypeFromOrder(
        { price_type: "Naqt", payment_method_ref: null },
        priceOptions,
        priceEntries
      )
    ).toBe("NAXT");
  });
});

describe("paymentMethodIdForPriceType", () => {
  const options = [
    { id: "pm-nal", name: "Nal" },
    { id: "pm-term", name: "Terminal" }
  ];
  const pmEntries = [
    { id: "pm-nal", name: "Nal", code: "nal" },
    { id: "pm-term", name: "Terminal", code: "terminal" }
  ];

  it("maps selected price type to linked payment select id", () => {
    expect(paymentMethodIdForPriceType("TERM", priceEntries, options, pmEntries)).toBe("pm-term");
    expect(paymentMethodIdForPriceType("Terminal", priceEntries, options, pmEntries)).toBe("pm-term");
  });
});

describe("matchPaymentMethodSelectId", () => {
  const options = [
    { id: "pm-nal", name: "Nal" },
    { id: "pm-term", name: "Terminal" }
  ];
  const entries = [
    { id: "pm-nal", name: "Nal", code: "nal" },
    { id: "pm-term", name: "Terminal", code: "terminal" }
  ];

  it("maps storage key / code to select id", () => {
    expect(matchPaymentMethodSelectId("nal", options, entries)).toBe("pm-nal");
  });

  it("keeps uuid id", () => {
    expect(matchPaymentMethodSelectId("pm-term", options, entries)).toBe("pm-term");
  });
});

describe("resolveLockedOrderAgentId", () => {
  const agents = [
    { id: 7, name: "Murodqulova Nargiza", login: "nargiza" },
    { id: 9, name: "Other Agent", login: "other" }
  ];

  it("uses agent_id when present", () => {
    expect(resolveLockedOrderAgentId({ agent_id: 7, agent_name: "X" }, agents)).toBe("7");
  });

  it("falls back to agent_name when id is missing", () => {
    expect(
      resolveLockedOrderAgentId({ agent_id: null, agent_name: "Murodqulova Nargiza" }, agents)
    ).toBe("7");
  });
});

describe("countPositiveQtyEntries", () => {
  it("counts products with qty > 0", () => {
    expect(countPositiveQtyEntries({ 1: "20", 2: "0", 3: "1.5" })).toBe(2);
  });
});
