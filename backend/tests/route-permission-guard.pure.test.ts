import { describe, expect, it } from "vitest";
import { matchRule, ROUTE_PERMISSION_RULES } from "../src/modules/access/route-permission-guard";

describe("route-permission-guard matchRule", () => {
  it("maps GET /orders list to orders.zakaz.view", () => {
    const rule = matchRule("GET", "/api/:slug/orders");
    expect(rule).not.toBeNull();
    expect(rule!.anyOf).toContain("orders.zakaz.view");
  });

  it("maps POST /orders to orders.zakaz.create", () => {
    const rule = matchRule("POST", "/api/:slug/orders");
    expect(rule?.anyOf).toContain("orders.zakaz.create");
  });

  it("maps PATCH /orders/:id/status to orders.zakaz.status", () => {
    const rule = matchRule("PATCH", "/api/:slug/orders/:id/status");
    expect(rule?.anyOf).toContain("orders.zakaz.status");
  });

  it("maps GET /stock/balances to warehouse.ostatki.view", () => {
    const rule = matchRule("GET", "/api/:slug/stock/balances");
    expect(rule?.anyOf).toContain("warehouse.ostatki.view");
  });

  it("maps GET /clients to clients.klient.view", () => {
    const rule = matchRule("GET", "/api/:slug/clients");
    expect(rule?.anyOf).toContain("clients.klient.view");
  });

  it("returns null for unmatched routes", () => {
    expect(matchRule("GET", "/api/:slug/health")).toBeNull();
    expect(matchRule("GET", "/health")).toBeNull();
  });

  it("has rules for core modules (orders, warehouse, cash, clients)", () => {
    const joined = ROUTE_PERMISSION_RULES.flatMap((r) => r.anyOf).join(" ");
    expect(joined).toContain("orders.zakaz.");
    expect(joined).toContain("warehouse.");
    expect(joined).toContain("cash.");
    expect(joined).toContain("clients.klient.");
  });
});
