import { describe, expect, it } from "vitest";
import {
  isFullOrderItemReturn,
  partialItemsToReturnLines
} from "../src/modules/mobile/mobile.expeditor.partial-return";

const items = [
  { id: 1, qty: 4, product_id: 10, is_bonus: false },
  { id: 2, qty: 1, product_id: 10, is_bonus: true }
];

describe("expeditor partial return split", () => {
  it("treats every line at full qty as a full return", () => {
    expect(
      isFullOrderItemReturn(items, [
        { order_item_id: 1, qty: 4 },
        { order_item_id: 2, qty: 1 }
      ])
    ).toBe(true);
  });

  it("does not treat a smaller qty as a full return", () => {
    expect(isFullOrderItemReturn(items, [{ order_item_id: 1, qty: 1 }])).toBe(false);
    expect(isFullOrderItemReturn(items, [])).toBe(false);
  });

  it("splits paid and bonus quantities by product", () => {
    expect(
      partialItemsToReturnLines(items, [
        { order_item_id: 1, qty: 2 },
        { order_item_id: 2, qty: 1 }
      ])
    ).toEqual([{ product_id: 10, paid_qty: 2, bonus_qty: 1 }]);
  });
});
