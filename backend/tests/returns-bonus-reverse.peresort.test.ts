import { describe, expect, it } from "vitest";
import { resolveAutoPeresortWarehouse } from "../src/modules/returns/returns-bonus-reverse.peresort";
import type { ProductReturnPool } from "../src/modules/returns/returns-bonus-reverse.pools";

function pool(max_paid: number, max_bonus: number): ProductReturnPool {
  return {
    max_paid,
    max_bonus,
    unit_price_paid: 1000,
    unit_price_bonus: 500
  };
}

describe("resolveAutoPeresortWarehouse", () => {
  it("keeps same SKU when bonus pool is enough", () => {
    const poolByProduct = new Map<number, ProductReturnPool>([
      [1, pool(5, 3)]
    ]);
    const r = resolveAutoPeresortWarehouse({
      sourceProductId: 1,
      sourceName: "A",
      bonusQty: 2,
      paidQty: 3,
      poolByProduct,
      unitPriceBonus: 500
    });
    expect(r.bonus_warehouse_product_id).toBe(1);
    expect(r.allocation_mode).toBe("same");
    expect(r.peresort_debt_amount).toBe(0);
  });

  it("picks sibling with enough pool", () => {
    const poolByProduct = new Map<number, ProductReturnPool>([
      [1, pool(5, 1)],
      [2, pool(0, 4)]
    ]);
    const r = resolveAutoPeresortWarehouse({
      sourceProductId: 1,
      sourceName: "A",
      bonusQty: 3,
      paidQty: 2,
      poolByProduct,
      siblings: [{ id: 2, name: "B" }],
      unitPriceBonus: 500
    });
    expect(r.bonus_warehouse_product_id).toBe(2);
    expect(r.allocation_mode).toBe("mixed");
    expect(r.peresort_debt_amount).toBe(0);
  });

  it("adds peresort debt when target pool is short", () => {
    const poolByProduct = new Map<number, ProductReturnPool>([
      [1, pool(5, 0)],
      [2, pool(0, 1)]
    ]);
    const r = resolveAutoPeresortWarehouse({
      sourceProductId: 1,
      sourceName: "A",
      bonusQty: 3,
      paidQty: 0,
      poolByProduct,
      siblings: [{ id: 2, name: "B" }],
      unitPriceBonus: 500
    });
    expect(r.bonus_warehouse_product_id).toBe(2);
    expect(r.allocation_mode).toBe("peresort");
    expect(r.peresort_debt_amount).toBe(1000);
  });
});
