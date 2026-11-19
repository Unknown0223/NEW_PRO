/**
 * ADR-008 M1.3: PolkiReturnPolicy pure (rebalance, max return, submit slice).
 */
import { describe, expect, it } from "vitest";
import {
  buildPolkiRows,
  buildPolkiSubmitSlice,
  canShowPolkiGrid,
  isPolkiAutoBonusOverMax,
  maxReturnQty,
  productMaxReturn,
  rebalanceComposition,
  setReturnQtyCapped
} from "../components/orders/order-create/polki-policy/polki-return-policy.logic";
import type { PolkiPairRowModel } from "../components/orders/order-create/types";

function row(partial: Partial<PolkiPairRowModel> = {}): PolkiPairRowModel {
  return {
    pair_key: "1-1",
    order_id: 1,
    order_number: "O1",
    product_id: 1,
    name: "Test",
    sku: "SKU",
    unit: "dona",
    max_paid: 5,
    max_bonus: 2,
    unit_price_paid: 1000,
    unit_price_bonus: 500,
    category_id: 1,
    volume_m3: null,
    ...partial
  };
}

describe("maxReturnQty / setReturnQtyCapped / productMaxReturn", () => {
  it("max = paid + bonus", () => {
    expect(maxReturnQty(row())).toBe(7);
  });

  it("caps qty to row max", () => {
    expect(setReturnQtyCapped(row(), 99)).toBe(7);
    expect(setReturnQtyCapped(row(), 3)).toBe(3);
  });

  it("product pool sums rows", () => {
    const rows = [
      row({ pair_key: "1-1", product_id: 1, max_paid: 2, max_bonus: 1 }),
      row({ pair_key: "2-1", order_id: 2, product_id: 1, max_paid: 3, max_bonus: 0 })
    ];
    expect(productMaxReturn(rows, 1)).toBe(6);
  });
});

describe("rebalanceComposition / buildPolkiRows", () => {
  it("rebalances floor pieces and merges indivisible bonus", () => {
    const items = [
      {
        product_id: 1,
        sku: "A",
        name: "Mahsulot 1",
        unit: "dona",
        qty: "9.5",
        price: "1000",
        is_bonus: false,
        order_id: 10,
        order_number: "Z-1",
        category_id: 1
      },
      {
        product_id: 2,
        sku: "B",
        name: "Mahsulot 2",
        unit: "dona",
        qty: "9.5",
        price: "1000",
        is_bonus: false,
        order_id: 10,
        order_number: "Z-1",
        category_id: 1
      },
      {
        product_id: 2,
        sku: "B",
        name: "Mahsulot 2",
        unit: "dona",
        qty: "1",
        price: "0",
        is_bonus: true,
        order_id: 10,
        order_number: "Z-1",
        category_id: 1
      }
    ];
    const rows = buildPolkiRows({ items, products: [], isPolkiFree: false });
    const r1 = rows.find((r) => r.product_id === 1)!;
    const r2 = rows.find((r) => r.product_id === 2)!;
    expect(r1.max_paid + r2.max_paid).toBe(19);
    expect(r1.max_bonus + r2.max_bonus).toBe(1);
    expect(r2.max_bonus).toBe(1);
    // same via public rebalanceComposition
    const built = buildPolkiRows({ items, products: [], isPolkiFree: true });
    const rebalanced = rebalanceComposition(built, items);
    expect(rebalanced.some((r) => r.max_bonus === 1)).toBe(true);
  });
});

describe("canShowPolkiGrid", () => {
  it("by-order needs selected order", () => {
    expect(
      canShowPolkiGrid({
        isPolkiSheet: true,
        hasClient: true,
        hasWarehouse: true,
        isPolkiFree: false,
        isPolkiByOrder: true,
        selectedOrderCount: 0
      })
    ).toBe(false);
    expect(
      canShowPolkiGrid({
        isPolkiSheet: true,
        hasClient: true,
        hasWarehouse: true,
        isPolkiFree: false,
        isPolkiByOrder: true,
        selectedOrderCount: 1
      })
    ).toBe(true);
  });

  it("free period with client+warehouse", () => {
    expect(
      canShowPolkiGrid({
        isPolkiSheet: true,
        hasClient: true,
        hasWarehouse: true,
        isPolkiFree: true,
        isPolkiByOrder: false,
        selectedOrderCount: 0
      })
    ).toBe(true);
  });
});

describe("isPolkiAutoBonusOverMax", () => {
  it("flags qty above max return", () => {
    expect(
      isPolkiAutoBonusOverMax({
        rows: [row()],
        polkiTotalQty: { "1-1": "99" },
        explicitByPairKey: {}
      })
    ).toBe(true);
  });

  it("ok within max", () => {
    expect(
      isPolkiAutoBonusOverMax({
        rows: [row()],
        polkiTotalQty: { "1-1": "3" },
        explicitByPairKey: { "1-1": { paid: 2, bonus: 1 } }
      })
    ).toBe(false);
  });
});

describe("buildPolkiSubmitSlice", () => {
  it("period merge for single-order by-order", () => {
    const r = row({ max_paid: 5, max_bonus: 0, unit_price_paid: 100 });
    const slice = buildPolkiSubmitSlice({
      rows: [r],
      polkiTotalQty: { "1-1": "3" },
      polkiBonusToBalance: {},
      polkiBonusCash: {},
      polkiBonusGoodsQty: {},
      polkiBonusCashQty: {},
      polkiPeresortByPairKey: {},
      polkiAutoBonusExplicitByPairKey: {},
      polkiAutoBonusPeresortByPairKey: {},
      polkiUsesAutoBonus: false,
      isPolkiFree: false,
      isPolkiByOrder: true,
      polkiBonusCalcMode: "manual"
    });
    expect(slice.usePeriodBatch).toBe(false);
    expect(slice.periodMerge.get(1)).toEqual({ paid: 3, bonus: 0, cash: 0 });
    expect(slice.batchLines).toHaveLength(0);
    expect(slice.missingOrderId).toBe(false);
  });
});

describe("filterEligiblePolkiOrders", () => {
  it("filters pickable + eligible ids when balances ready", async () => {
    const { filterEligiblePolkiOrders } = await import(
      "../components/orders/order-create/polki-policy/polki-return-policy.logic"
    );
    const orders = [
      { id: 1, number: "A", status: "delivered", created_at: "2026-01-01", order_type: "order" },
      { id: 2, number: "B", status: "new", created_at: "2026-01-01", order_type: "order" },
      { id: 3, number: "C", status: "delivered", created_at: "2026-01-01", order_type: "order" }
    ] as import("../components/orders/order-create/types").PolkiOrderPickRow[];
    expect(filterEligiblePolkiOrders(orders, new Set([1]), true).map((o) => o.id)).toEqual([1]);
    expect(filterEligiblePolkiOrders(orders, new Set([1]), false).map((o) => o.id)).toEqual([1, 3]);
  });
});
