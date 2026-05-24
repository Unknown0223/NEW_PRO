import { describe, expect, it } from "vitest";
import { adjustOrderItemsQtyAfterPriorReturns } from "../src/modules/returns/returns-enhanced.helpers";
import type { OrderItemSummary } from "../src/modules/returns/returns-enhanced.types";

function item(
  productId: number,
  qty: number,
  isBonus: boolean,
  orderId = 9
): OrderItemSummary {
  return {
    product_id: productId,
    sku: `SKU${productId}`,
    name: `Product ${productId}`,
    unit: "шт",
    qty: String(qty),
    price: "1000",
    total: String(qty * 1000),
    is_bonus: isBonus,
    order_id: orderId,
    order_number: "9",
    category_id: null
  };
}

describe("adjustOrderItemsQtyAfterPriorReturns — bonus spill to paid", () => {
  it("bonus-only qaytarish pullik pozitsiyadan o‘tgan bo‘lsa pullik qoldiqni kamaytiradi", () => {
    const items = [item(1, 23, false), item(1, 7, true)];
    const returns = [
      {
        order_id: 9,
        lines: [
          { product_id: 1, qty: 8, paid_qty: 0, bonus_qty: 8 },
          { product_id: 2, qty: 8, paid_qty: 0, bonus_qty: 8 }
        ]
      }
    ];
    const adjusted = adjustOrderItemsQtyAfterPriorReturns(items, returns);
    const paidLeft = adjusted.filter((i) => i.product_id === 1 && !i.is_bonus);
    const bonusLeft = adjusted.filter((i) => i.product_id === 1 && i.is_bonus);
    expect(Number(paidLeft[0]?.qty ?? 0)).toBe(22);
    expect(Number(bonusLeft[0]?.qty ?? 0)).toBe(0);
  });
});
