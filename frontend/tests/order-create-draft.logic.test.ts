/**
 * ADR-008 M1.4: OrderCreateDraft pure submit build + flags.
 */
import { describe, expect, it } from "vitest";
import type { ProductRow } from "@/lib/product-types";
import {
  buildExchangeSubmitBody,
  buildOrdinaryItems,
  canSubmitExchangeBase,
  canSubmitOrdinaryBase,
  computeEstimatedSum,
  computeHasMissingPriceForSelected,
  computeHasQtyOverStock,
  computeSelectedItemsCount
} from "../components/orders/order-create/draft/draft.logic";

function product(partial: Partial<ProductRow> & { id: number; name: string }): ProductRow {
  return {
    sku: "SKU",
    unit: "dona",
    is_active: true,
    category_id: 1,
    prices: [{ price_type: "retail", price: "1000" }],
    ...partial
  } as ProductRow;
}

describe("buildOrdinaryItems", () => {
  it("builds items within stock", () => {
    const result = buildOrdinaryItems({
      qtyByProductId: { 1: "2", 2: "0" },
      stockRows: [
        { product_id: 1, qty: "10", reserved_qty: "1" },
        { product_id: 2, qty: "5", reserved_qty: "0" }
      ],
      sameWarehouseAsEdit: false,
      editReservedQtyByProduct: {}
    });
    expect(result).toEqual({ ok: true, items: [{ product_id: 1, qty: 2 }] });
  });

  it("rejects qty over stock", () => {
    const result = buildOrdinaryItems({
      qtyByProductId: { 1: "20" },
      stockRows: [{ product_id: 1, qty: "5", reserved_qty: "0" }],
      sameWarehouseAsEdit: false,
      editReservedQtyByProduct: {}
    });
    expect(result).toEqual({ ok: false, reason: "qty_over_stock" });
  });

  it("adds edit reserved when same warehouse", () => {
    const result = buildOrdinaryItems({
      qtyByProductId: { 1: "8" },
      stockRows: [{ product_id: 1, qty: "10", reserved_qty: "5" }],
      sameWarehouseAsEdit: true,
      editReservedQtyByProduct: { 1: 5 }
    });
    // avail = 10-5+5 = 10 → 8 ok
    expect(result).toEqual({ ok: true, items: [{ product_id: 1, qty: 8 }] });
  });
});

describe("stock/price flags + estimatedSum", () => {
  const catalog = [
    product({ id: 1, name: "A" }),
    product({ id: 2, name: "B", prices: [] })
  ];

  it("computeHasQtyOverStock", () => {
    expect(
      computeHasQtyOverStock({
        catalogProducts: catalog,
        qtyByProductId: { 1: "3" },
        stockRows: [{ product_id: 1, qty: "2", reserved_qty: "0" }],
        sameWarehouseAsEdit: false,
        editReservedQtyByProduct: {}
      })
    ).toBe(true);
  });

  it("computeHasMissingPriceForSelected", () => {
    expect(
      computeHasMissingPriceForSelected({
        catalogProducts: catalog,
        qtyByProductId: { 2: "1" },
        priceType: "retail"
      })
    ).toBe(true);
  });

  it("computeEstimatedSum uses min(qty, avail) * price", () => {
    expect(
      computeEstimatedSum({
        catalogProducts: catalog,
        qtyByProductId: { 1: "3" },
        stockRows: [{ product_id: 1, qty: "2", reserved_qty: "0" }],
        priceType: "retail"
      })
    ).toBe(2000);
  });

  it("computeSelectedItemsCount falls back to edit qty map", () => {
    expect(
      computeSelectedItemsCount({
        catalogProducts: [],
        qtyByProductId: { 9: "2" },
        isEditMode: true
      })
    ).toBe(1);
  });
});

describe("canSubmitBase flags", () => {
  it("ordinary requires lines + stock ready", () => {
    expect(
      canSubmitOrdinaryBase({
        hasClient: true,
        hasWarehouse: true,
        selectedItemsCount: 1,
        mutationPending: false,
        loadingLists: false,
        editFormBlocked: false,
        stockReadyForLines: true,
        hasQtyOverStock: false,
        hasMissingPriceForSelected: false,
        requiresAgentAndPayment: true,
        hasAgent: true,
        requiresPaymentMethodForSubmit: false,
        hasPaymentMethod: false
      })
    ).toBe(true);
  });

  it("exchange requires payload ok", () => {
    expect(
      canSubmitExchangeBase({
        hasClient: true,
        hasWarehouse: true,
        hasAgent: true,
        exchangeReturnsSuccess: true,
        exchangePayloadOk: false,
        mutationPending: false,
        loadingLists: false
      })
    ).toBe(false);
  });
});

describe("buildExchangeSubmitBody", () => {
  it("delegates to buildExchangeCreateBody", () => {
    const result = buildExchangeSubmitBody({
      sourceOrderIds: [1],
      minusKey: "1-2",
      minusQty: "1",
      plusProductId: "3",
      plusQty: "1",
      pairRows: [
        {
          key: "1-2",
          order_id: 1,
          product_id: 2,
          max: 5,
          sku: "S",
          name: "N"
        }
      ]
    });
    expect(result.ok).toBe(true);
  });
});
