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

  it("does not apply web photo-report RBAC to mobile photo routes", () => {
    expect(matchRule("GET", "/api/:slug/mobile/clients/:id/photo-reports")).toBeNull();
    expect(matchRule("POST", "/api/:slug/mobile/clients/:id/photo-reports")).toBeNull();
  });

  it("maps GET /client-balances to cash.balansy_klientov.view (not only otchety)", () => {
    const rule = matchRule("GET", "/api/:slug/client-balances");
    expect(rule?.anyOf).toContain("cash.balansy_klientov.view");
    expect(rule?.anyOf).toContain("cash.otchety.view");
  });

  it("maps GET /client-balances/consignment to balansy_klientov", () => {
    const rule = matchRule("GET", "/api/:slug/client-balances/consignment");
    expect(rule?.anyOf).toContain("cash.balansy_klientov.view");
  });

  it("maps GET /opening-balances to nachalnye_balansy.view", () => {
    const rule = matchRule("GET", "/api/:slug/opening-balances");
    expect(rule?.anyOf).toContain("cash.nachalnye_balansy.view");
  });

  it("dashboard/supervisor/products → dashboard.supervayzer, not settings.tovar", () => {
    const dash = matchRule("GET", "/api/:slug/dashboard/supervisor/products");
    expect(dash?.anyOf).toEqual(
      expect.arrayContaining(["dashboard.supervayzer.view", "dashboard.supervayzer"])
    );
    expect(dash?.anyOf).not.toContain("settings.tovar.view");

    const catalog = matchRule("GET", "/api/:slug/products");
    expect(catalog?.anyOf).toContain("settings.tovar.view");

    const catalogById = matchRule("GET", "/api/:slug/products/12");
    expect(catalogById?.anyOf).toContain("settings.tovar.view");
  });

  it("maps bank-transfer-inbox read/import/assign to cash.perechisleniya.*", () => {
    const view = matchRule("GET", "/api/:slug/bank-transfer-inbox");
    expect(view?.anyOf).toContain("cash.perechisleniya.view");

    const counts = matchRule("GET", "/api/:slug/bank-transfer-inbox/counts");
    expect(counts?.anyOf).toContain("cash.perechisleniya.view");

    const ingest = matchRule("POST", "/api/:slug/bank-transfer-inbox/ingest");
    expect(ingest?.anyOf).toEqual(
      expect.arrayContaining(["cash.perechisleniya.import", "cash.perechisleniya.create"])
    );

    const importRule = matchRule("POST", "/api/:slug/bank-transfer-inbox/import");
    expect(importRule?.anyOf).toEqual(
      expect.arrayContaining(["cash.perechisleniya.import", "cash.perechisleniya.create"])
    );

    const manual = matchRule("POST", "/api/:slug/bank-transfer-inbox/manual");
    expect(manual?.anyOf).toEqual(
      expect.arrayContaining(["cash.perechisleniya.import", "cash.perechisleniya.create"])
    );

    const assign = matchRule("POST", "/api/:slug/bank-transfer-inbox/:id/assign");
    expect(assign?.anyOf).toContain("cash.perechisleniya.update");

    const reassign = matchRule("POST", "/api/:slug/bank-transfer-inbox/:id/reassign");
    expect(reassign?.anyOf).toContain("cash.perechisleniya.update");
  });
});
