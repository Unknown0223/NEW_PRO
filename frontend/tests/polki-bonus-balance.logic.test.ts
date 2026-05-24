import { describe, expect, it } from "vitest";
import {
  allocationModeLabel,
  buildRowBonusDisplay,
  computePolkiLineDebt,
  peresortSelectOptions,
  parsePolkiQty
} from "../components/orders/order-create/polki-bonus-balance.logic";
import { buildPolkiPairRows } from "../components/orders/order-create/utils";
import {
  applyPolkiOrderPieceRebalance,
  rebalancePolkiOrderPieceTotals
} from "../components/orders/order-create/view/polki-shelf-return/polki-order-composition";
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

describe("parsePolkiQty", () => {
  it("parses comma decimal as whole pieces (floor)", () => {
    expect(parsePolkiQty("2,5")).toBe(2);
    expect(parsePolkiQty("8.85")).toBe(8);
  });
});

describe("rebalancePolkiOrderPieceTotals", () => {
  it("redistributes lost floor pieces and merges indivisible bonus to one product", () => {
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
    const built = buildPolkiPairRows(items, []);
    const rows = applyPolkiOrderPieceRebalance(built, items);
    const r1 = rows.find((r) => r.product_id === 1)!;
    const r2 = rows.find((r) => r.product_id === 2)!;
    expect(r1.max_paid + r2.max_paid).toBe(19);
    expect(r1.max_bonus + r2.max_bonus).toBe(1);
    expect(r1.max_bonus).toBe(0);
    expect(r2.max_bonus).toBe(1);
  });
});

describe("peresortSelectOptions", () => {
  it("returns only self when no siblings", () => {
    const opts = peresortSelectOptions(10, "A", undefined);
    expect(opts).toHaveLength(1);
    expect(opts[0]!.id).toBe(10);
  });

  it("includes siblings when group exists", () => {
    const opts = peresortSelectOptions(10, "A", [{ id: 20, name: "B" }]);
    expect(opts).toHaveLength(2);
    expect(opts[1]!.id).toBe(20);
  });
});

describe("computePolkiLineDebt", () => {
  it("adds debt for unallocated qty beyond paid+bonus caps", () => {
    const d = computePolkiLineDebt({
      row: row({ max_paid: 2, max_bonus: 1, unit_price_bonus: 100 }),
      totalQty: 5,
      deferToBalance: false,
      cashRaw: ""
    });
    expect(d).toBeGreaterThan(0);
  });

  it("buildRowBonusDisplay shows peresort label", () => {
    const d = buildRowBonusDisplay({
      row: row(),
      sharePaid: 2,
      shareBonus: 1,
      previewLine: {
        bonus_warehouse_product_id: 20,
        bonus_warehouse_product_name: "B",
        allocation_mode: "peresort",
        bonus_debt_qty: 0,
        bonus_debt_amount: 0,
        rule_label: "5+1"
      }
    });
    expect(d?.allocationLabel).toBe("Пересорт");
    expect(d?.bonusWarehouseLabel).toContain("→");
    expect(d?.ruleLabel).toBe("5+1");
  });

  it("allocationModeLabel maps mixed", () => {
    expect(allocationModeLabel("mixed")).toBe("Аралаш");
  });

  it("adds debt when balance compensation is short", () => {
    const d = computePolkiLineDebt({
      row: row(),
      totalQty: 7,
      deferToBalance: true,
      cashRaw: "0"
    });
    expect(d).toBeGreaterThan(0);
  });
});
