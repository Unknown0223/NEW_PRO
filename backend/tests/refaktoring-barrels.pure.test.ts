/**
 * Refaktoring v1 — barrel re-export smoke (backward-compatible import yo‘llari).
 */
import { describe, expect, it } from "vitest";

describe("refaktoring v1 barrel smoke", () => {
  it("orders.service re-export domain", async () => {
    const mod = await import("../src/modules/orders/orders.service");
    expect(typeof mod.listOrdersPaged).toBe("function");
    expect(typeof mod.createOrder).toBe("function");
  });

  it("staff.service re-export", async () => {
    const mod = await import("../src/modules/staff/staff.service");
    expect(typeof mod.listStaff).toBe("function");
    expect(typeof mod.createStaff).toBe("function");
  });

  it("payments.service re-export", async () => {
    const mod = await import("../src/modules/payments/payments.service");
    expect(typeof mod.listPayments).toBe("function");
    expect(typeof mod.createPayment).toBe("function");
  });

  it("dashboard.service re-export", async () => {
    const mod = await import("../src/modules/dashboard/dashboard.service");
    expect(typeof mod.getDashboardStats).toBe("function");
    expect(typeof mod.getSalesDashboardSnapshot).toBe("function");
  });

  it("clients.service re-export", async () => {
    const mod = await import("../src/modules/clients/clients.service");
    expect(typeof mod.listClientsForTenantPaged).toBe("function");
    expect(typeof mod.createClientMinimal).toBe("function");
  });

  it("stock.service re-export", async () => {
    const mod = await import("../src/modules/stock/stock.service");
    expect(typeof mod.listStockBalances).toBe("function");
  });
});
