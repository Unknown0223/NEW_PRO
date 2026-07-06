import { describe, expect, it } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import { Prisma as PrismaClient } from "@prisma/client";
import {
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  QTY_AGGREGATE_PURCHASED_PID,
  resolveQtyGiftProductId,
  ruleHasPurchaseScope,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleRelatesToOrderSelection,
  sumMatchingOrderQtyForQtyRule
} from "../src/modules/orders/order-bonus-apply";
import { mergeQtyPeeksByRule } from "../src/modules/orders/order-bonus-qty";
import { computeQtyBonusForRuleRow } from "../src/modules/bonus-rules/bonus-rules.qty";

function rule(over: Partial<BonusRuleRow>): BonusRuleRow {
  return {
    id: 1,
    tenant_id: 1,
    name: "t",
    type: "qty",
    buy_qty: null,
    free_qty: null,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: null,
    priority: 1,
    is_active: true,
    valid_from: null,
    valid_to: null,
    created_at: "",
    updated_at: "",
    client_category: null,
    payment_type: null,
    client_type: null,
    sales_channel: null,
    price_type: null,
    product_ids: [],
    bonus_product_ids: [],
    product_category_ids: [],
    target_all_clients: true,
    selected_client_ids: [],
    is_manual: false,
    in_blocks: false,
    once_per_client: false,
    one_plus_one_gift: false,
    prerequisite_rule_ids: [],
    scope_branch_codes: [],
    scope_agent_user_ids: [],
    scope_trade_direction_ids: [],
    conditions: [],
    ...over
  };
}

describe("effectivePurchasedQtyForQtyRule", () => {
  it("order — faqat joriy miqdor", () => {
    const r = rule({ type: "qty", sum_threshold_scope: "order" });
    expect(
      effectivePurchasedQtyForQtyRule(r, {
        orderQty: 10,
        productIdForMonthLookup: null,
        monthAggregateExclOrder: 50,
        monthByProductExclOrder: new Map()
      })
    ).toBe(10);
  });

  it("calendar_month — agregat: oy + zakaz", () => {
    const r = rule({ type: "qty", sum_threshold_scope: "calendar_month" });
    expect(
      effectivePurchasedQtyForQtyRule(r, {
        orderQty: 10,
        productIdForMonthLookup: null,
        monthAggregateExclOrder: 50,
        monthByProductExclOrder: new Map()
      })
    ).toBe(60);
  });

  it("calendar_month — SKU bo‘yicha", () => {
    const r = rule({ type: "qty", sum_threshold_scope: "calendar_month" });
    const m = new Map([[5, 20]]);
    expect(
      effectivePurchasedQtyForQtyRule(r, {
        orderQty: 3,
        productIdForMonthLookup: 5,
        monthAggregateExclOrder: 999,
        monthByProductExclOrder: m
      })
    ).toBe(23);
  });
});

describe("effectiveSubtotalForSumMinRule", () => {
  it("order — faqat bazaviy summa", () => {
    const r = rule({ type: "sum", sum_threshold_scope: "order" });
    const base = new PrismaClient.Decimal(100);
    const month = new PrismaClient.Decimal(500);
    expect(effectiveSubtotalForSumMinRule(r, base, month).toString()).toBe("100");
  });

  it("calendar_month — oy + joriy zakaz", () => {
    const r = rule({ type: "sum", sum_threshold_scope: "calendar_month" });
    const base = new PrismaClient.Decimal(100);
    const month = new PrismaClient.Decimal(500);
    expect(effectiveSubtotalForSumMinRule(r, base, month).toString()).toBe("600");
  });
});

describe("ruleMatchesOrderAgentScope", () => {
  const agent = (over: Partial<{ userId: number; branch: string | null; trade_direction_id: number | null }>) => ({
    userId: 1,
    branch: "Tash" as string | null,
    trade_direction_id: 10 as number | null,
    ...over
  });

  it("hammasi bo‘sh — true", () => {
    const r = rule({});
    expect(ruleMatchesOrderAgentScope(r, null)).toBe(true);
    expect(ruleMatchesOrderAgentScope(r, agent({}))).toBe(true);
  });

  it("filial mos — true", () => {
    const r = rule({ scope_branch_codes: ["Tash"] });
    expect(ruleMatchesOrderAgentScope(r, agent({ branch: "tash" }))).toBe(true);
  });

  it("filial mos emas, agent ro‘yxatda — OR", () => {
    const r = rule({ scope_branch_codes: ["Other"], scope_agent_user_ids: [1] });
    expect(ruleMatchesOrderAgentScope(r, agent({ userId: 1, branch: "X" }))).toBe(true);
  });

  it("agent yo‘q, cheklov bor — false", () => {
    const r = rule({ scope_agent_user_ids: [1] });
    expect(ruleMatchesOrderAgentScope(r, null)).toBe(false);
  });

  it("yo‘nalish ID mos emas — false", () => {
    const r = rule({ scope_trade_direction_ids: [99] });
    expect(ruleMatchesOrderAgentScope(r, agent({ trade_direction_id: 10 }))).toBe(false);
  });
});

describe("ruleMatchesClient", () => {
  it("rad etadi — target_all_clients false va mijoz ro‘yxatda yo‘q", () => {
    const r = rule({ target_all_clients: false, selected_client_ids: [9] });
    expect(ruleMatchesClient(r, { id: 1, category: null })).toBe(false);
  });

  it("qabul qiladi — target_all_clients true", () => {
    const r = rule({ target_all_clients: true, client_category: null });
    expect(ruleMatchesClient(r, { id: 1, category: "retail" })).toBe(true);
  });

  it("client_category mos kelmasa — false", () => {
    const r = rule({ target_all_clients: true, client_category: "wholesale" });
    expect(ruleMatchesClient(r, { id: 1, category: "retail" })).toBe(false);
  });
});

describe("ruleMatchesOrderProductScope", () => {
  const map = new Map<number, { id: number; category_id: number | null }>([
    [10, { id: 10, category_id: 5 }],
    [20, { id: 20, category_id: null }]
  ]);

  it("product_ids bo‘lsa va zakazda yo‘q — false", () => {
    const r = rule({ product_ids: [99], product_category_ids: [] });
    expect(ruleMatchesOrderProductScope(r, new Set([10]), map)).toBe(false);
  });

  it("product_category_ids bo‘lsa va mos kategoriya bor — true", () => {
    const r = rule({ product_ids: [], product_category_ids: [5] });
    expect(ruleMatchesOrderProductScope(r, new Set([10]), map)).toBe(true);
  });
});

describe("ruleHasPurchaseScope", () => {
  it("bo‘sh asortiment — false (umumiy miqdor rejimi)", () => {
    expect(ruleHasPurchaseScope(rule({ product_ids: [], product_category_ids: [] }))).toBe(false);
  });
  it("product_ids bor — true", () => {
    expect(ruleHasPurchaseScope(rule({ product_ids: [1], product_category_ids: [] }))).toBe(true);
  });
  it("faqat kategoriya — true", () => {
    expect(ruleHasPurchaseScope(rule({ product_ids: [], product_category_ids: [2] }))).toBe(true);
  });
});

describe("ruleRelatesToOrderSelection", () => {
  const map = new Map<number, { id: number; category_id: number | null }>([
    [10, { id: 10, category_id: 5 }],
    [30, { id: 30, category_id: 7 }]
  ]);

  it("sotib olish doirasi bo‘lsa — zakazda mos kategoriya yetarli", () => {
    const r = rule({ product_ids: [], product_category_ids: [5] });
    expect(ruleRelatesToOrderSelection(r, new Set([10]), map)).toBe(true);
  });

  it("faqat sovg‘a SKU (boshqa kategoriya) — zakazda o‘sha kategoriya yo‘q — false", () => {
    const r = rule({
      product_ids: [],
      product_category_ids: [],
      bonus_product_ids: [30]
    });
    expect(ruleRelatesToOrderSelection(r, new Set([10]), map)).toBe(false);
  });

  it("sovg‘a SKU kategoriyasi zakazda bor — true", () => {
    const r = rule({
      product_ids: [],
      product_category_ids: [],
      bonus_product_ids: [30]
    });
    expect(ruleRelatesToOrderSelection(r, new Set([30]), map)).toBe(true);
  });

  it("umumiy qoida (mahsulot bog‘i yo‘q) — true", () => {
    const r = rule({ product_ids: [], product_category_ids: [], bonus_product_ids: [] });
    expect(ruleRelatesToOrderSelection(r, new Set([10]), map)).toBe(true);
  });
});

describe("computeQtyBonusForRuleRow 6+1 in_blocks", () => {
  it("14 dona → 2 bonus", () => {
    const r = rule({
      type: "qty",
      buy_qty: 6,
      free_qty: 1,
      in_blocks: true,
      conditions: []
    });
    expect(computeQtyBonusForRuleRow(r, 14)).toBe(2);
    expect(computeQtyBonusForRuleRow(r, 12)).toBe(2);
    expect(computeQtyBonusForRuleRow(r, 5)).toBe(0);
  });

  it("in_blocks false — faqat 1 marta", () => {
    const r = rule({
      type: "qty",
      buy_qty: 6,
      free_qty: 1,
      in_blocks: false,
      conditions: []
    });
    expect(computeQtyBonusForRuleRow(r, 14)).toBe(1);
  });
});

describe("sumMatchingOrderQtyForQtyRule", () => {
  it("kategoriya bo‘yicha miqdor yig‘iladi", () => {
    const r = rule({ product_category_ids: [10] });
    const productById = new Map<number, { id: number; category_id: number | null }>([
      [1, { id: 1, category_id: 10 }],
      [2, { id: 2, category_id: 10 }],
      [3, { id: 3, category_id: 99 }]
    ]);
    const qtyByProduct = new Map([
      [1, 10],
      [2, 4],
      [3, 100]
    ]);
    const { totalQty, heroProductId } = sumMatchingOrderQtyForQtyRule(r, qtyByProduct, productById);
    expect(totalQty).toBe(14);
    expect(heroProductId).toBe(1);
  });
});

describe("mergeQtyPeeksByRule", () => {
  it("bir xil rule_id va giftPid — bitta peek, bonus_qty yig‘indisi", () => {
    const r = rule({ id: 42, name: "6+1" });
    const merged = mergeQtyPeeksByRule([
      { rule: r, purchasedPid: 10, giftPid: 100, bonusQty: 1 },
      { rule: r, purchasedPid: 20, giftPid: 100, bonusQty: 1 }
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.rule.id).toBe(42);
    expect(merged[0]!.bonusQty).toBe(2);
  });

  it("bir xil rule_id, har xil giftPid (har SKU o‘z mahsuloti) — alohida peeklar", () => {
    const r = rule({ id: 42, name: "6+1", bonus_product_ids: [] });
    const merged = mergeQtyPeeksByRule([
      { rule: r, purchasedPid: 10, giftPid: 10, bonusQty: 6 },
      { rule: r, purchasedPid: 20, giftPid: 20, bonusQty: 3 }
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => p.bonusQty).sort((a, b) => a - b)).toEqual([3, 6]);
  });
});

describe("resolveQtyGiftProductId", () => {
  it("override ro‘yxatda — override", () => {
    const r = rule({ id: 7, bonus_product_ids: [10, 20] });
    const m = new Map([[7, 20]]);
    expect(resolveQtyGiftProductId(r, 99, m)).toBe(20);
  });
  it("override noto‘g‘ri — birinchi default", () => {
    const r = rule({ id: 7, bonus_product_ids: [10, 20] });
    expect(resolveQtyGiftProductId(r, 99, new Map([[7, 999]]))).toBe(10);
  });
  it("bonus ro‘yxat bo‘sh — sotilgan mahsulot", () => {
    const r = rule({ bonus_product_ids: [] });
    expect(resolveQtyGiftProductId(r, 55, new Map())).toBe(55);
  });
  it("aggregate placeholder bilan", () => {
    const r = rule({ id: 3, bonus_product_ids: [8, 9] });
    expect(resolveQtyGiftProductId(r, QTY_AGGREGATE_PURCHASED_PID, new Map([[3, 9]]))).toBe(9);
  });
  it("qator mahsuloti ro‘yxatda lekin omborda yetarli emas — boshqa SKU (qoldiq bo‘yicha)", () => {
    const r = rule({ bonus_product_ids: [10, 20] });
    const avail = new Map<number, number>([
      [10, 0],
      [20, 5]
    ]);
    expect(resolveQtyGiftProductId(r, 10, new Map(), { availableByProductId: avail, minUnits: 2 })).toBe(20);
  });
  it("assortiment auto: ombor yetarli emas — baribir sotilgan SKU", () => {
    const r = rule({
      product_ids: [10, 20],
      bonus_product_ids: [10, 20],
      scope_restrict_assortment: true,
      scope_restrict_category: false
    });
    const avail = new Map<number, number>([
      [10, 0],
      [20, 0]
    ]);
    expect(resolveQtyGiftProductId(r, 10, new Map(), { availableByProductId: avail, minUnits: 2 })).toBe(10);
  });
  it("barcha variantlarda yetarli emas — ro‘yxatdagi birinchi (fallback)", () => {
    const r = rule({ bonus_product_ids: [10, 20] });
    const avail = new Map<number, number>([
      [10, 0],
      [20, 0]
    ]);
    expect(resolveQtyGiftProductId(r, 10, new Map(), { availableByProductId: avail, minUnits: 3 })).toBe(10);
  });
});
