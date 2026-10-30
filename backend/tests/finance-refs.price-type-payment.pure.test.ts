import { describe, expect, it } from "vitest";
import {
  expandPaymentMethodFilterValues,
  orderListPriceTypeLabel,
  paymentMethodsFromUnknown,
  priceTypeEntriesFromUnknown,
  resolveStoredPaymentMethodRef
} from "../src/modules/tenant-settings/finance-refs";

const pmEntries = paymentMethodsFromUnknown([
  { id: "pm-nal", name: "Nal", code: "nal", currency_code: "UZS", active: true },
  { id: "pm-term", name: "Terminal", code: "terminal", currency_code: "UZS", active: true }
]);

const ptEntries = priceTypeEntriesFromUnknown([
  {
    id: "pt-naxt",
    name: "Naxt",
    code: "NAXT",
    payment_method_id: "pm-nal",
    kind: "sale",
    active: true
  },
  {
    id: "pt-term",
    name: "Kartochka",
    code: "TERM",
    payment_method_id: "pm-term",
    kind: "sale",
    active: true
  }
]);

describe("resolveStoredPaymentMethodRef", () => {
  it("keeps explicit payment_method_ref", () => {
    expect(
      resolveStoredPaymentMethodRef({
        paymentMethodRef: "terminal",
        priceType: "NAXT",
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries
      })
    ).toBe("terminal");
  });

  it("preferPriceType maps price type over a stale payment_method_ref", () => {
    expect(
      resolveStoredPaymentMethodRef({
        paymentMethodRef: "nal",
        priceType: "TERM",
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries,
        preferPriceType: true
      })
    ).toBe("terminal");
  });

  it("maps mobile price_type to linked payment method storage key", () => {
    expect(
      resolveStoredPaymentMethodRef({
        paymentMethodRef: null,
        priceType: "NAXT",
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries
      })
    ).toBe("nal");
  });

  it("matches price type by name or id", () => {
    expect(
      resolveStoredPaymentMethodRef({
        priceType: "Naxt",
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries
      })
    ).toBe("nal");
    expect(
      resolveStoredPaymentMethodRef({
        priceType: "pt-term",
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries
      })
    ).toBe("terminal");
  });

  it("falls back to raw price_type when catalog miss", () => {
    expect(
      resolveStoredPaymentMethodRef({
        priceType: "retail",
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries
      })
    ).toBe("retail");
  });

  it("returns null when nothing provided", () => {
    expect(
      resolveStoredPaymentMethodRef({
        priceTypeEntries: ptEntries,
        paymentMethodEntries: pmEntries
      })
    ).toBeNull();
  });
});

describe("orderListPriceTypeLabel", () => {
  it("shows payment method name for stored storage key", () => {
    expect(orderListPriceTypeLabel("nal", pmEntries, ptEntries)).toBe("Nal");
  });

  it("shows price type name when ref is a price type key", () => {
    expect(orderListPriceTypeLabel("NAXT", pmEntries, ptEntries)).toBe("Naxt");
  });

  it("returns null for empty", () => {
    expect(orderListPriceTypeLabel("  ", pmEntries, ptEntries)).toBeNull();
  });
});

describe("expandPaymentMethodFilterValues", () => {
  it("expands payment method code to id, name, and linked price types", () => {
    const aliases = expandPaymentMethodFilterValues(["nal"], pmEntries, ptEntries);
    expect(aliases).toEqual(expect.arrayContaining(["nal", "pm-nal", "Nal", "NAXT", "Naxt", "pt-naxt"]));
  });

  it("expands price type key to linked payment method", () => {
    const aliases = expandPaymentMethodFilterValues(["NAXT"], pmEntries, ptEntries);
    expect(aliases).toEqual(expect.arrayContaining(["NAXT", "nal", "pm-nal"]));
  });
});
