import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  orderMerchandiseNetReceivable,
  applyOrderLevelDiscountPctToItems,
  ruleAppliesMerchandiseDiscount,
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

  it("type=discount qoidasi — total_sum allaqachon net (qayta ayirmaydi)", () => {
    const net = orderMerchandiseNetReceivable(
      new Prisma.Decimal("540000"),
      new Prisma.Decimal("60000"),
      [3],
      rules([[3, { type: "discount", discount_pct: 10 }]])
    );
    expect(net.toString()).toBe("540000");
  });

  it("type=sum + discount_pct — total_sum allaqachon net (ikki marta ayirmaydi)", () => {
    // UI: Сумма 2_175_000, skidka 217_500 → API total_sum=1_957_500
    const net = orderMerchandiseNetReceivable(
      new Prisma.Decimal("1957500"),
      new Prisma.Decimal("217500"),
      [2],
      rules([[2, { type: "sum", discount_pct: 10 }]])
    );
    expect(net.toString()).toBe("1957500");
  });

  it("discount_sum > 0, applied qoida yo'q — baribir total_sum (net kontrakti)", () => {
    const net = orderMerchandiseNetReceivable(
      new Prisma.Decimal("1957500"),
      new Prisma.Decimal("217500"),
      [],
      rules([])
    );
    expect(net.toString()).toBe("1957500");
  });
});

describe("ruleAppliesMerchandiseDiscount", () => {
  it("discount va sum+pct", () => {
    expect(ruleAppliesMerchandiseDiscount({ type: "discount", discount_pct: 10 })).toBe(true);
    expect(ruleAppliesMerchandiseDiscount({ type: "sum", discount_pct: 10 })).toBe(true);
    expect(ruleAppliesMerchandiseDiscount({ type: "sum", discount_pct: null })).toBe(false);
    expect(ruleAppliesMerchandiseDiscount({ type: "qty", discount_pct: null })).toBe(false);
  });
});

describe("applyOrderLevelDiscountPctToItems", () => {
  it("totalSum berilsa — foiz = disc / (net + disc), hatto linesAlreadyNet=false", () => {
    // Eski xato: net qatorlardan foiz → ~11%; to‘g‘ri: 10%
    const items = applyOrderLevelDiscountPctToItems(
      [
        { is_bonus: false, total: "900000", discount_pct: "0.00" },
        { is_bonus: false, total: "1057500", discount_pct: "0.00" }
      ],
      new Prisma.Decimal("217500"),
      { totalSum: new Prisma.Decimal("1957500") }
    );
    expect(items[0]?.discount_pct).toBe("10");
    expect(items[1]?.discount_pct).toBe("10");
  });

  it("type=discount (qatorlar net) — foiz = disc / (net + disc)", () => {
    const items = applyOrderLevelDiscountPctToItems(
      [
        { is_bonus: false, total: "517500", discount_pct: "0.00" },
        { is_bonus: false, total: "1728000", discount_pct: "0.00" }
      ],
      new Prisma.Decimal("249500"),
      { totalSum: new Prisma.Decimal("2245500"), linesAlreadyNet: true }
    );
    expect(items[0]?.discount_pct).toBe("10");
    expect(items[1]?.discount_pct).toBe("10");
  });

  it("mavjud qator skidkasi o'zgarmaydi", () => {
    const items = applyOrderLevelDiscountPctToItems(
      [{ is_bonus: false, total: "540000", discount_pct: "10.00" }],
      new Prisma.Decimal("60000")
    );
    expect(items[0]?.discount_pct).toBe("10.00");
  });
});
