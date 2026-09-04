import { describe, expect, it } from "vitest";
import { isDashboardCacheKeyForTenant } from "../src/modules/dashboard/dashboard.cache-keys";
import { pctAgainstSalesAndBucket } from "../src/modules/dashboard/dashboard.helpers";
import { ORDER_STATUSES_EXCLUDED_FROM_SALES } from "../src/modules/orders/order-status";

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
});
