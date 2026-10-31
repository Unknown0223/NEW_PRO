import { describe, expect, it } from "vitest";
import { paidLinesUnchanged } from "../src/modules/orders/domain/order.lines";

describe("paidLinesUnchanged", () => {
  it("treats the same paid lines as unchanged so bonus refresh can save", () => {
    expect(
      paidLinesUnchanged(
        [
          { product_id: 1, qty: "2.000" },
          { product_id: 2, qty: 1 }
        ],
        [
          { product_id: 2, qty: "1" },
          { product_id: 1, qty: 2 }
        ]
      )
    ).toBe(true);
  });

  it("detects a quantity change an operator must not save", () => {
    expect(
      paidLinesUnchanged([{ product_id: 1, qty: 1 }], [{ product_id: 1, qty: 2 }])
    ).toBe(false);
  });
});
