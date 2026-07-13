import { describe, expect, it } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import {
  ruleHasPurchaseScope,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  qtyRuleMatchingProductIds,
  resolveQtyGiftProductId
} from "../src/modules/orders/order-bonus-context.match-scope";
import type { OrderAgentBonusContext, ProductLite } from "../src/modules/orders/order-bonus-context.fetch";

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
    scope_agent_user_ids: [],
    scope_branch_codes: [],
    scope_trade_direction_ids: [],
    scope_warehouse_ids: [],
    scope_territory_refs: [],
    scope_zones: [],
    scope_regions: [],
    scope_cities: [],
    payment_method_ref: null,
    trade_direction_ref: null,
    scope_trade_direction_refs: [],
    consignment_mode: null,
    request_type_refs: [],
    source_channels: [],
    execution_type: null,
    execution_time: null,
    n_value: null,
    ...over
  };
}

describe("order-bonus-context.match-scope", () => {
  it("ruleHasPurchaseScope — product_ids bo‘sh emas", () => {
    expect(ruleHasPurchaseScope(rule({ product_ids: [1] }))).toBe(true);
    expect(ruleHasPurchaseScope(rule({ product_ids: [] }))).toBe(false);
  });

  it("ruleMatchesOrderAgentScope — filial OR agent", () => {
    const agent: OrderAgentBonusContext = { userId: 5, branch: "north", trade_direction_id: 1 };
    expect(
      ruleMatchesOrderAgentScope(
        rule({ scope_branch_codes: ["north"], scope_agent_user_ids: [99] }),
        agent
      )
    ).toBe(true);
    expect(ruleMatchesOrderAgentScope(rule({ scope_branch_codes: ["south"] }), agent)).toBe(false);
  });

  it("ruleMatchesOrderProductScope — kategoriya filtri", () => {
    const products = new Map<number, ProductLite>([[10, { id: 10, category_id: 3 }]]);
    expect(
      ruleMatchesOrderProductScope(rule({ product_category_ids: [3] }), new Set([10]), products)
    ).toBe(true);
    expect(
      ruleMatchesOrderProductScope(rule({ product_category_ids: [9] }), new Set([10]), products)
    ).toBe(false);
  });

  it("qtyRuleMatchingProductIds — faqat mos SKU", () => {
    const products = new Map<number, ProductLite>([
      [1, { id: 1, category_id: 1 }],
      [2, { id: 2, category_id: 2 }]
    ]);
    const qty = new Map<number, number>([
      [1, 5],
      [2, 0]
    ]);
    expect(qtyRuleMatchingProductIds(rule({ product_ids: [1, 2] }), qty, products)).toEqual([1]);
  });

  it("ruleMatchesClient — kategoriya va tanlangan mijoz", async () => {
    const { ruleMatchesClient } = await import("../src/modules/orders/order-bonus-context.fetch");
    const allClients = rule({ target_all_clients: true });
    expect(ruleMatchesClient(allClients, { id: 1, category: "A" })).toBe(true);
    const selected = rule({ target_all_clients: false, selected_client_ids: [7] });
    expect(ruleMatchesClient(selected, { id: 7, category: null })).toBe(true);
    expect(ruleMatchesClient(selected, { id: 8, category: null })).toBe(false);
    const catRule = rule({ target_all_clients: true, client_category: "VIP" });
    expect(ruleMatchesClient(catRule, { id: 1, category: "VIP" })).toBe(true);
    expect(ruleMatchesClient(catRule, { id: 1, category: "STD" })).toBe(false);
  });

  it("resolveQtyGiftProductId — assortiment (5+1): har trigger-mahsulot o‘z sovg‘asiga qulflangan", () => {
    // Mahsulot 1 = 17 dona (17÷5=3), Mahsulot 2 = 12 dona (12÷5=2) — har biri FAQAT o‘zidan sovg‘a beradi,
    // boshqa mahsulotga almashtirib bo‘lmaydi (mobil UI’da locked/read-only bo‘lishi kerak).
    const assortmentRule = rule({ product_ids: [1, 2], bonus_product_ids: [] });
    expect(resolveQtyGiftProductId(assortmentRule, 1, new Map(), { minUnits: 3 })).toBe(1);
    expect(resolveQtyGiftProductId(assortmentRule, 2, new Map(), { minUnits: 2 })).toBe(2);
  });

  it("bonusRoomAfterPaidQty — pullik savatdan keyin bonus joyi", async () => {
    const { bonusRoomAfterPaidQty } = await import(
      "../src/modules/orders/order-bonus-context.match-scope"
    );
    const room = bonusRoomAfterPaidQty(
      new Map([
        [1, 51],
        [2, 87]
      ]),
      new Map([
        [1, 22],
        [2, 87]
      ])
    );
    expect(room.get(1)).toBe(29);
    expect(room.get(2)).toBe(0);
  });

  it("pickGiftFromAllowedList — pullik yegan SKU o‘rniga qolgan joyi borini tanlaydi", async () => {
    const { pickGiftFromAllowedList } = await import(
      "../src/modules/orders/order-bonus-context.match-scope"
    );
    // Ombor: M2=87, M1=51; savatdan keyin room: M2=0, M1=29
    const room = new Map([
      [1, 29],
      [2, 0]
    ]);
    expect(pickGiftFromAllowedList([1, 2], 2, room, 10)).toBe(1);
  });

  it("resolveQtyGiftProductId — category_stock: ombordagi eng ko‘p qoldiqli mahsulotdan", () => {
    // Kategoriya doirasi, aniq sovg‘a SKU tanlanmagan — xarid qilingan mahsulotdan qat’i nazar
    // eng ko‘p ombor qoldig‘iga ega nomzod tanlanadi (mahsulot 2 emas, mahsulot 20 — ko‘proq qoldiq).
    const categoryRule = rule({ product_category_ids: [5], bonus_product_ids: [] });
    const availableByProductId = new Map<number, number>([
      [10, 2],
      [20, 9],
      [30, 5]
    ]);
    expect(
      resolveQtyGiftProductId(categoryRule, 10, new Map(), {
        availableByProductId,
        minUnits: 3,
        categoryCandidateIds: [10, 20, 30]
      })
    ).toBe(20);
  });

  it("resolveQtyGiftProductId — category_stock: nomzodlar bo‘sh bo‘lsa xarid qilingan mahsulotga qaytadi", () => {
    const categoryRule = rule({ product_category_ids: [5], bonus_product_ids: [] });
    expect(
      resolveQtyGiftProductId(categoryRule, 10, new Map(), { minUnits: 1, categoryCandidateIds: [] })
    ).toBe(10);
  });

  it("roundMoney — 2 xona yaxlitlash", async () => {
    const { Prisma } = await import("@prisma/client");
    const { roundMoney } = await import("../src/modules/orders/order-bonus-context.fetch");
    expect(roundMoney(new Prisma.Decimal("10.005")).toString()).toBe("10.01");
    expect(roundMoney(new Prisma.Decimal("10.004")).toString()).toBe("10");
  });
});

describe("phone-number value object", () => {
  it("normalize va validate", async () => {
    const { normalizePhoneNumber, isValidPhoneNumber } = await import("../src/domain/phone-number");
    expect(isValidPhoneNumber("+998 90 123 45 67")).toBe(true);
    expect(normalizePhoneNumber("+998 90 123 45 67")).toBe("998901234567");
    expect(isValidPhoneNumber("123")).toBe(false);
  });
});

describe("tenant-id value object", () => {
  it("tenantIdFrom rejects invalid", async () => {
    const { tenantIdFrom } = await import("../src/domain/tenant-id");
    expect(() => tenantIdFrom(0)).toThrow("INVALID_TENANT_ID");
    expect(tenantIdFrom(1)).toBe(1);
  });
});
