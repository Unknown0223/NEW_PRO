import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  orderMerchandiseNetReceivable,
  applyOrderLevelDiscountPctToItems,
  type OrderMerchandiseRuleHint
} from "../src/modules/orders/order-merchandise-net";

function rules(
  entries: Array<[number, OrderMerchandiseRuleHint]>
): Map<number, OrderMerchandiseRuleHint> {
  return new Map(entries);
}

describe("orderMerchandiseNetReceivable", () => {
  it("skidka yo'q — total_sum", () => {
    const net = orderMerchandiseNetReceivable(
      new Prisma.Decimal("100000"),
      new Prisma.Decimal(0),
      [],
      rules([])
    );
    expect(net.toString()).toBe("100000");
  });

  it("type=discount qoidasi — total_sum allaqachon net", () => {
    const net = orderMerchandiseNetReceivable(
      new Prisma.Decimal("540000"),
      new Prisma.Decimal("60000"),
      [3],
      rules([[3, { type: "discount", discount_pct: 10 }]])
    );
    expect(net.toString()).toBe("540000");
  });

  it("type=sum + discount_sum (discount qoidasi yo'q) — skidka ayiriladi", () => {
    const net = orderMerchandiseNetReceivable(
      new Prisma.Decimal("2070000"),
      new Prisma.Decimal("230000"),
      [2],
      rules([[2, { type: "sum", discount_pct: null }]])
    );
    expect(net.toString()).toBe("1840000");
  });
});

describe("applyOrderLevelDiscountPctToItems", () => {
  it("zakaz darajasidagi skidka qatorlarga foiz sifatida taqsimlanadi", () => {
    const items = applyOrderLevelDiscountPctToItems(
      [
        { is_bonus: false, total: "990000", discount_pct: "0.00" },
        { is_bonus: false, total: "1080000", discount_pct: "0.00" }
      ],
      new Prisma.Decimal("230000")
    );
    expect(items[0]?.discount_pct).toBe("11.11");
    expect(items[1]?.discount_pct).toBe("11.11");
  });

  it("mavjud qator skidkasi o'zgarmaydi", () => {
    const items = applyOrderLevelDiscountPctToItems(
      [{ is_bonus: false, total: "540000", discount_pct: "10.00" }],
      new Prisma.Decimal("60000")
    );
    expect(items[0]?.discount_pct).toBe("10.00");
  });
});
