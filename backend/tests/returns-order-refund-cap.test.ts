import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { finalizePolkiReturnLines, priceByProductFromItems } from "../src/modules/returns/returns-enhanced.compute";
import {
  assertOrderHasPhysicalRemaining,
  computeOrderRemainingPaidRefundCap
} from "../src/modules/returns/returns-order-balance";
import type { OrderItemSummary } from "../src/modules/returns/returns-enhanced.types";
import { scaleReturnLinesToMaxRefund } from "../src/modules/returns/returns-enhanced.compute";

function paidItem(productId: number, qty: number, price: number, orderId = 9): OrderItemSummary {
  return {
    product_id: productId,
    sku: `SKU${productId}`,
    name: `P${productId}`,
    unit: "шт",
    qty: String(qty),
    price: String(price),
    total: String(qty * price),
    is_bonus: false,
    order_id: orderId,
    order_number: "9",
    category_id: null
  };
}

describe("computeOrderRemainingPaidRefundCap", () => {
  it("qolgan pullik pozitsiyalar summasi", () => {
    const cap = computeOrderRemainingPaidRefundCap([
      paidItem(1, 8, 25000),
      paidItem(2, 8, 11110.5)
    ]);
    expect(cap.toString()).toBe("288884");
  });

  it("bonus qatorlari hisobga olinmaydi", () => {
    const cap = computeOrderRemainingPaidRefundCap([
      paidItem(1, 8, 25000),
      { ...paidItem(1, 4, 25000), is_bonus: true }
    ]);
    expect(cap.toString()).toBe("200000");
  });
});

describe("finalizePolkiReturnLines (po zakaz)", () => {
  const lines = [
    { product_id: 1, qty: 8, paid_qty: 8, bonus_qty: 0, price: 25000 },
    { product_id: 2, qty: 8, paid_qty: 8, bonus_qty: 0, price: 11110.5 }
  ];

  it("pullik qaytarish saqlanadi — bonusga aylantirilmaydi", () => {
    const cap = new Prisma.Decimal("288884");
    const out = finalizePolkiReturnLines(lines, cap, { orderScoped: true });
    expect(out.refund.toString()).toBe("288884");
    expect(out.lines[0]!.paid_qty).toBe(8);
    expect(out.lines[0]!.bonus_qty).toBe(0);
  });

  it("qoldiqdan oshsa — xato (period rejimida bonusga aylantirilardi)", () => {
    expect(() =>
      finalizePolkiReturnLines(lines, new Prisma.Decimal(0), { orderScoped: true })
    ).toThrow("REFUND_EXCEEDS_ORDER_REMAINING");
  });

  it("period rejimi: maxRefund=0 → pullik bonusga (eski xatti-harakat)", () => {
    const legacy = scaleReturnLinesToMaxRefund(lines, new Prisma.Decimal(0));
    expect(legacy.refund.toString()).toBe("0");
    expect(legacy.lines[0]!.paid_qty).toBe(0);
    expect(legacy.lines[0]!.bonus_qty).toBe(8);
  });
});

describe("priceByProductFromItems", () => {
  it("pullik narx bonus qatoridan ustun", () => {
    const m = priceByProductFromItems([
      { product_id: 1, price: "22500", is_bonus: false },
      { product_id: 1, price: "25000", is_bonus: true }
    ]);
    expect(m.get(1)).toBe(22500);
  });
});

describe("assertOrderHasPhysicalRemaining", () => {
  it("qoldiq 0/0 — qulf", () => {
    expect(() => assertOrderHasPhysicalRemaining([])).toThrow("ORDER_FULLY_RETURNED");
  });
});
