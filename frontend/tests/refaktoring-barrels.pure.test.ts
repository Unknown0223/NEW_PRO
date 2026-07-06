import { describe, expect, it } from "vitest";
import { isProtectedRoute, PROTECTED_ROUTE_PREFIXES } from "../lib/routes";

describe("refaktoring v1 frontend smoke", () => {
  it("order-create barrel re-export", async () => {
    const mod = await import("../components/orders/order-create-workspace");
    expect(typeof mod.OrderCreateWorkspace).toBe("function");
  });

  it("order-create shell imports hook and view", async () => {
    const shell = await import("../components/orders/order-create/order-create-workspace");
    expect(typeof shell.OrderCreateWorkspace).toBe("function");
  });

  it("PROTECTED_ROUTE_PREFIXES non-empty", () => {
    expect(PROTECTED_ROUTE_PREFIXES.length).toBeGreaterThan(0);
    expect(isProtectedRoute("/orders")).toBe(true);
    expect(isProtectedRoute("/login")).toBe(false);
  });

  it("auth-sync exports session helpers", async () => {
    const mod = await import("../lib/auth-sync");
    expect(mod.AUTH_STORAGE_KEY).toBeTruthy();
    expect(typeof mod.syncAuthToCookie).toBe("function");
  });
});
