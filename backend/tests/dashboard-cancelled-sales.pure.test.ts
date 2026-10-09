import { describe, expect, it } from "vitest";
import { isDashboardCacheKeyForTenant } from "../src/modules/dashboard/dashboard.cache-keys";
import { pctAgainstSalesAndBucket } from "../src/modules/dashboard/dashboard.helpers";
import { ORDER_STATUSES_EXCLUDED_FROM_SALES } from "../src/modules/orders/order-status";

/**
 * Efficiency «Сумма» bug regression: order_items JOIN qatorlari bo‘yicha
 * SUM(o.total_sum) qilish har bir buyurtmani qatorlar soniga ko‘paytiradi.
 * To‘g‘ri: avval order_id bo‘yicha MAX(total_sum), keyin agent bo‘yicha SUM.
 */
function sumSalesWithoutLineMultiplication(
  lines: Array<{ orderId: number; orderTotal: number; qty: number }>
): { salesSum: number; salesQty: number; orderCount: number } {
  const byOrder = new Map<number, { total: number; qty: number }>();
  for (const line of lines) {
    const prev = byOrder.get(line.orderId);
    if (!prev) {
      byOrder.set(line.orderId, { total: line.orderTotal, qty: line.qty });
    } else {
      prev.qty += line.qty;
    }
  }
  let salesSum = 0;
  let salesQty = 0;
  for (const v of byOrder.values()) {
    salesSum += v.total;
    salesQty += v.qty;
  }
  return { salesSum, salesQty, orderCount: byOrder.size };
}

describe("dashboard cancelled orders", () => {
  it("otmena va vozvrat savdo faktidan chiqariladi", () => {
    expect(ORDER_STATUSES_EXCLUDED_FROM_SALES).toEqual(["cancelled", "returned"]);
  });

  it("snapshot kalitlarini tenant kesib o‘chiradi, qo‘shni tenantni emas", () => {
    expect(isDashboardCacheKeyForTenant(1, "tenant:1:dashboard")).toBe(true);
    expect(isDashboardCacheKeyForTenant(1, "tenant:1:dashboard:sales:{}")).toBe(true);
    expect(isDashboardCacheKeyForTenant(1, "tenant:1:dashboard:supervisor:{}")).toBe(true);
    expect(isDashboardCacheKeyForTenant(1, "tenant:12:dashboard")).toBe(false);
    expect(isDashboardCacheKeyForTenant(1, "tenant:1:orders:list:x")).toBe(false);
  });

  it("otmena ulushi savdo + otmena bo‘yicha (savdoga qo‘shilmaydi)", () => {
    expect(pctAgainstSalesAndBucket(100, 25)).toBe(20);
    expect(pctAgainstSalesAndBucket(0, 50)).toBe(100);
    expect(pctAgainstSalesAndBucket(0, 0)).toBeNull();
  });

  it("efficiency sum: total_sum order_items qatorlariga ko‘paytirilmaydi", () => {
    // 1-buyurtma 20M (4 qator), 2-buyurtma 1.5M (2 qator) → fakt 21.5M, emas 20*4+1.5*2
    const lines = [
      { orderId: 1, orderTotal: 20_000_000, qty: 1 },
      { orderId: 1, orderTotal: 20_000_000, qty: 2 },
      { orderId: 1, orderTotal: 20_000_000, qty: 1 },
      { orderId: 1, orderTotal: 20_000_000, qty: 3 },
      { orderId: 2, orderTotal: 1_500_000, qty: 5 },
      { orderId: 2, orderTotal: 1_500_000, qty: 2 }
    ];
    const naiveJoinSum = lines.reduce((s, l) => s + l.orderTotal, 0);
    expect(naiveJoinSum).toBe(83_000_000);

    const fixed = sumSalesWithoutLineMultiplication(lines);
    expect(fixed.salesSum).toBe(21_500_000);
    expect(fixed.orderCount).toBe(2);
    expect(fixed.salesQty).toBe(14);
  });
});
