import { describe, expect, it } from "vitest";
import { aggregateExchangeShipmentSides } from "../src/modules/mobile/mobile.expeditor.exchange-shipment.pure";

describe("aggregateExchangeShipmentSides", () => {
  it("returns zeros for empty list", () => {
    expect(aggregateExchangeShipmentSides([])).toEqual({
      exchange_ship: { qty: 0, sum: 0 },
      exchange_return: { qty: 0, sum: 0 }
    });
  });

  it("splits plus/minus line totals; qty is exchange order count per side", () => {
    const out = aggregateExchangeShipmentSides([
      {
        items: [
          { exchange_line_kind: "minus", total: 100, is_bonus: false },
          { exchange_line_kind: "plus", total: 250, is_bonus: false }
        ]
      },
      {
        items: [
          { exchange_line_kind: "minus", total: "50.5", is_bonus: false },
          { exchange_line_kind: "plus", total: "80", is_bonus: false },
          { exchange_line_kind: "plus", total: 10, is_bonus: true }
        ]
      }
    ]);

    // 2 docs with plus, 2 with minus; bonus plus ignored in sum
    expect(out.exchange_ship).toEqual({ qty: 2, sum: 330 });
    expect(out.exchange_return).toEqual({ qty: 2, sum: 150.5 });
  });

  it("counts a side only when that kind has a non-bonus line", () => {
    const out = aggregateExchangeShipmentSides([
      {
        items: [{ exchange_line_kind: "plus", total: 40, is_bonus: false }]
      },
      {
        items: [{ exchange_line_kind: "minus", total: 15, is_bonus: false }]
      }
    ]);

    expect(out.exchange_ship).toEqual({ qty: 1, sum: 40 });
    expect(out.exchange_return).toEqual({ qty: 1, sum: 15 });
  });
});
