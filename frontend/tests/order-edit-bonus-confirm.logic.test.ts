import { describe, expect, it } from "vitest";
import {
  buildGiftLinesFromQtyMap,
  clampGiftQty,
  giftsForBonusConfirmModal,
  hydrateApplyBonusForNewOrderEdit,
  initialGiftQtyMap,
  initialStrategySelections,
  maxBonusQtyForRule,
  shouldConfirmBonusOnWebNewEdit,
  toggleStrategyRule,
  type OrderBonusEligiblePreview
} from "../components/orders/order-create/order-edit-bonus-confirm.logic";

function rule(over: Partial<OrderBonusEligiblePreview> & Pick<OrderBonusEligiblePreview, "rule_id" | "name">): OrderBonusEligiblePreview {
  return {
    type: "qty",
    bonus_qty: 2,
    max_bonus_qty: 2,
    allow_gift_swap: true,
    gift_products: [
      { product_id: 10, name: "A", bonus_qty: 2 },
      { product_id: 11, name: "B", bonus_qty: 0 }
    ],
    ...over
  };
}

describe("order-edit-bonus-confirm.logic", () => {
  it("maxBonusQtyForRule — earned va cap dan kichigini oladi", () => {
    expect(maxBonusQtyForRule(rule({ rule_id: 1, name: "R", bonus_qty: 5, max_bonus_qty: 3 }))).toBe(3);
    expect(maxBonusQtyForRule(rule({ rule_id: 1, name: "R", bonus_qty: 2, max_bonus_qty: null }))).toBe(2);
  });

  it("clampGiftQty — max dan oshirmaydi", () => {
    expect(clampGiftQty("5", 3)).toBe(3);
    expect(clampGiftQty("1,5", 10)).toBe(1);
    expect(clampGiftQty("", 5)).toBe(0);
    expect(clampGiftQty("-2", 5)).toBe(0);
  });

  it("initialGiftQtyMap — gift_products bo‘sh bo‘lsa auto_apply ni to‘ldiradi", () => {
    const map = initialGiftQtyMap(
      [rule({ rule_id: 9, name: "R9", gift_products: [], bonus_qty: 1, max_bonus_qty: 1 })],
      [{ product_id: 44, qty: 1 }]
    );
    expect(map["9"]?.["44"]).toBe("1");
  });

  it("buildGiftLinesFromQtyMap — faqat >0 qiymatlarni yuboradi", () => {
    const lines = buildGiftLinesFromQtyMap(
      [rule({ rule_id: 7, name: "R7", bonus_qty: 3, max_bonus_qty: 3 })],
      { "7": { "10": "2", "11": "1" } }
    );
    expect(lines).toEqual([
      { bonus_rule_id: 7, product_id: 10, qty: 2 },
      { bonus_rule_id: 7, product_id: 11, qty: 1 }
    ]);
  });

  it("buildGiftLinesFromQtyMap — jami max dan oshirmaydi", () => {
    const lines = buildGiftLinesFromQtyMap(
      [rule({ rule_id: 7, name: "R7", bonus_qty: 2, max_bonus_qty: 2 })],
      { "7": { "10": "2", "11": "5" } }
    );
    expect(lines).toEqual([{ bonus_rule_id: 7, product_id: 10, qty: 2 }]);
  });

  it("strategy selections — toggle max_select ga rioya qiladi", () => {
    const strategy = {
      strategy_id: 1,
      name: "S",
      max_select: 1,
      eligible_rule_ids: [10, 20],
      auto_selected_rule_ids: [10],
      requires_choice: true
    };
    const init = initialStrategySelections([strategy]);
    expect(init).toEqual([{ strategy_id: 1, rule_ids: [10] }]);
    const next = toggleStrategyRule(init, strategy, 20);
    expect(next).toEqual([{ strategy_id: 1, rule_ids: [20] }]);
  });
});

describe("shouldConfirmBonusOnWebNewEdit", () => {
  const base = {
    isEditMode: true,
    hasEditOrderId: true,
    applyBonus: true,
    isPolkiSheet: false,
    isExchangeFlow: false
  };

  it("web Новый tahrir + avto bonus — tasdiq kerak", () => {
    expect(shouldConfirmBonusOnWebNewEdit(base)).toBe(true);
  });

  it("bonus o‘chirilgan — tasdiq yo‘q", () => {
    expect(shouldConfirmBonusOnWebNewEdit({ ...base, applyBonus: false })).toBe(false);
  });

  it("mobil orqali yaratilgan zakaz ham web tahrirda tasdiq oladi", () => {
    expect(shouldConfirmBonusOnWebNewEdit(base)).toBe(true);
  });
});

describe("hydrateApplyBonusForNewOrderEdit", () => {
  it("oldingi 0 bonus bo‘lsa ham tahrirda avto yoqiladi", () => {
    expect(hydrateApplyBonusForNewOrderEdit()).toBe(true);
  });
});

describe("giftsForBonusConfirmModal", () => {
  it("gift_products bo‘sh bo‘lsa auto_apply sovg‘alarini ko‘rsatadi", () => {
    const gifts = giftsForBonusConfirmModal(
      rule({ rule_id: 1, name: "R", gift_products: [] }),
      [{ product_id: 44, qty: 1 }]
    );
    expect(gifts).toEqual([{ product_id: 44, name: "#44", bonus_qty: 1 }]);
  });
});
