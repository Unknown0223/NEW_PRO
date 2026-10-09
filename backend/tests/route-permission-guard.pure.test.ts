import { describe, expect, it } from "vitest";
import { matchRule, ROUTE_PERMISSION_RULES } from "../src/modules/access/route-permission-guard";
import {
  ORDER_STATUS_CHANGE_PERMISSIONS,
  ORDER_STATUS_DATE_PERMISSION
} from "../src/modules/orders/order-status-permissions";

describe("route-permission-guard matchRule", () => {
  it("maps GET /orders list to orders.zakaz.view", () => {
    const rule = matchRule("GET", "/api/:slug/orders");
    expect(rule).not.toBeNull();
    expect(rule!.anyOf).toContain("orders.zakaz.view");
  });

  it("maps POST /orders to any create-page key (exact type checked in handler)", () => {
    const rule = matchRule("POST", "/api/:slug/orders");
    expect(rule?.anyOf).toEqual(
      expect.arrayContaining(["orders.sozdanie.create", "orders.obmen.create", "orders.vozvrat_polki.create", "orders.vozvrat_po_zakazu.create"])
    );
    expect(rule?.anyOf).not.toContain("orders.zakaz.view");
  });

  it("maps PATCH /orders/:id/status to per-status keys (also with :id(\\d+) route pattern)", () => {
    for (const path of ["/api/:slug/orders/:id/status", "/api/:slug/orders/:id(\\d+)/status"]) {
      const rule = matchRule("PATCH", path);
      expect(rule?.anyOf).toEqual(expect.arrayContaining(ORDER_STATUS_CHANGE_PERMISSIONS));
      expect(rule?.anyOf).not.toContain("orders.zakaz.status");
      expect(rule?.anyOf).not.toContain(ORDER_STATUS_DATE_PERMISSION);
    }
    expect(matchRule("PATCH", "/api/:slug/orders/:id(\\d+)/milestone-at")?.anyOf).toEqual([ORDER_STATUS_DATE_PERMISSION]);
    expect(matchRule("POST", "/api/:slug/orders/bulk/status")?.anyOf).toEqual(expect.arrayContaining(ORDER_STATUS_CHANGE_PERMISSIONS));
  });

  it("regex / custom-named route params normalize to :id", () => {
    expect(matchRule("PATCH", "/api/:slug/orders/:id(\\d+)")?.anyOf).toContain("orders.zakaz.update");
    expect(matchRule("DELETE", "/api/:slug/warehouses/:warehouseId")?.anyOf).toEqual(["warehouse.sklady.deactivate"]);
    expect(matchRule("POST", "/api/:slug/warehouses/:warehouseId/restore")?.anyOf).toEqual(["warehouse.sklady.activate"]);
    expect(matchRule("POST", "/api/:slug/warehouses")?.anyOf).toEqual(["warehouse.sklady.create"]);
    expect(matchRule("DELETE", "/api/:slug/opening-balances/:id(\\d+)")?.anyOf).toEqual(["cash.nachalnye_balansy.void"]);
  });

  it("supplier payments use suppliers.oplaty.*, not client payment keys", () => {
    expect(matchRule("GET", "/api/:slug/suppliers/accounting/payments")?.anyOf).toEqual(["suppliers.oplaty.view"]);
    expect(matchRule("POST", "/api/:slug/suppliers/accounting/payments")?.anyOf).toContain("suppliers.oplaty.create");
    expect(matchRule("DELETE", "/api/:slug/suppliers/accounting/payments/:paymentId")?.anyOf).toEqual(["suppliers.oplaty.update"]);
  });

  it("previously unguarded write routes are covered", () => {
    const cases: Array<[string, string, string]> = [
      ["POST", "/api/:slug/transfers", "warehouse.peremeshchenie.create"],
      ["POST", "/api/:slug/transfers/:id/receive", "warehouse.peremeshchenie.transfer"],
      ["PATCH", "/api/:slug/territories/:id", "settings.territoriya.update"],
      ["DELETE", "/api/:slug/territories/:id", "settings.territoriya.delete"],
      ["POST", "/api/:slug/reports/report-builder/saved", "reports.konstruktor.create"],
      ["POST", "/api/:slug/reports/report-builder/preview", "reports.konstruktor.view"],
      ["POST", "/api/:slug/payments/batch-confirm", "cash.oplaty_klientov.approve"],
      ["POST", "/api/:slug/payments/batch-return-to-expeditor", "cash.oplaty_klientov.approve"],
      ["POST", "/api/:slug/payments/:id/allocate", "cash.oplaty_klientov.update"],
      ["POST", "/api/:slug/payments/:id/edit-grants", "cash.oplaty_klientov.update"],
      ["PATCH", "/api/:slug/payments/:id", "cash.oplaty_klientov.update"],
      ["POST", "/api/:slug/payments/batch-delete", "cash.oplaty_klientov.delete"],
      ["POST", "/api/:slug/clients/merge", "clients.obedinenie.update"],
      ["POST", "/api/:slug/clients/merge-preview", "clients.obedinenie.view"],
      ["DELETE", "/api/:slug/currency-rates/:id", "cash.kurs_valyuty.update"],
      ["POST", "/api/:slug/order-restriction-rules", "orders.avtomatizatsiya.create"],
      ["PATCH", "/api/:slug/settings/bonus-stack", "settings.bonus_strategiya.update"],
      ["POST", "/api/:slug/bonus-rules", "settings.bonusy.create"],
      ["POST", "/api/:slug/bonus-rules", "settings.skidki.create"],
      ["DELETE", "/api/:slug/bonus-rules/:id", "settings.skidki.delete"],
      ["POST", "/api/:slug/bonus-strategies", "settings.bonus_strategiya.create"],
      ["PATCH", "/api/:slug/consignment/settings", "staff.konsignatsiya_zakrytie.update"],
      ["POST", "/api/:slug/consignment/import.xlsx", "staff.konsignatsiya.import"],
      ["PATCH", "/api/:slug/consignment/agents/bulk-rows", "staff.konsignatsiya.status"],
      ["PATCH", "/api/:slug/consignment/agents/bulk-rows", "staff.konsignatsiya.update"],
      ["POST", "/api/:slug/consignment/limits/transfer", "staff.konsignatsiya_perekid.update"],
      ["POST", "/api/:slug/consignment/limits/apply", "staff.konsignatsiya_limity.update"]
    ];
    for (const [method, path, key] of cases) {
      expect(matchRule(method, path)?.anyOf, `${method} ${path}`).toContain(key);
    }
  });

  it("cash desks: create, update and shift open/close are separate keys", () => {
    expect(matchRule("POST", "/api/:slug/cash-desks")?.anyOf).toEqual(["cash.kassa.create"]);
    expect(matchRule("PATCH", "/api/:slug/cash-desks/:id")?.anyOf).toEqual(["cash.kassa.update"]);
    expect(matchRule("POST", "/api/:slug/cash-desks/:id/shifts/open")?.anyOf).toEqual(["cash.kassa.status"]);
    expect(matchRule("POST", "/api/:slug/cash-desks/:id/shifts/:shiftId/close")?.anyOf).toEqual(["cash.kassa.status"]);
  });

  it("server-built Excel exports need the section export key, not view", () => {
    const cases: Array<[string, string]> = [
      ["/api/:slug/stock/recommended/export", "warehouse.rekomendovannyy_zapas.export"],
      ["/api/:slug/stock/material-report/export", "warehouse.materialnyy_otchet.export"],
      ["/api/:slug/stock/receipts-report/export", "warehouse.postuplenie.export"],
      ["/api/:slug/warehouse-blocks/export", "warehouse.bloki.export"],
      ["/api/:slug/reports/order-debts/export", "cash.otchety.export"],
      ["/api/:slug/reports/income-report/export/:kind", "cash.otchety.export"],
      ["/api/:slug/clients/:id/reconciliation-xlsx", "cash.otchety.export"],
      ["/api/:slug/work-slots/export.xlsx", "work_slots.raboche_mesto.export"],
      ["/api/:slug/settings/initial-setup/export-bundle.xlsx", "settings.initial_setup.export"],
      ["/api/:slug/audit-events/export.xlsx", "audit.log.export"]
    ];
    for (const [path, key] of cases) {
      expect(matchRule("GET", path)?.anyOf, path).toEqual([key]);
    }
    expect(matchRule("GET", "/api/:slug/stock/recommended")?.anyOf).toEqual(["warehouse.rekomendovannyy_zapas.view"]);
    expect(matchRule("GET", "/api/:slug/reports/product-sales/export")?.anyOf).toEqual(["reports.prodazhi_tovarov.export"]);
  });

  it("each report page has its own view/export key", () => {
    expect(matchRule("GET", "/api/:slug/reports/product-sales")?.anyOf).toEqual(["reports.prodazhi_tovarov.view"]);
    expect(matchRule("GET", "/api/:slug/reports/visits-2/export")?.anyOf).toEqual(["reports.vizity.export"]);
    expect(matchRule("GET", "/api/:slug/reports/agent-orders")?.anyOf).toEqual(["reports.zakazy_agentov.view"]);
    expect(matchRule("GET", "/api/:slug/reports/gps-delivery-routes")?.anyOf).toEqual(["reports.gps.view"]);
  });

  it("report builder: export, share and saved CRUD are separate keys", () => {
    expect(matchRule("POST", "/api/:slug/reports/report-builder/export")?.anyOf).toEqual(["reports.konstruktor.export"]);
    expect(matchRule("GET", "/api/:slug/reports/report-builder/saved/share-candidates")?.anyOf).toEqual([
      "reports.konstruktor.transfer"
    ]);
    expect(matchRule("POST", "/api/:slug/reports/report-builder/saved/:id/share")?.anyOf).toEqual([
      "reports.konstruktor.transfer"
    ]);
    expect(matchRule("PUT", "/api/:slug/reports/report-builder/saved/:id")?.anyOf).toEqual(["reports.konstruktor.update"]);
    expect(matchRule("DELETE", "/api/:slug/reports/report-builder/saved/:id")?.anyOf).toEqual(["reports.konstruktor.delete"]);
  });

  it("GPS monitoring accepts any per-role view key", () => {
    const anyOf = matchRule("GET", "/api/:slug/gps-monitoring/day")?.anyOf ?? [];
    expect(anyOf).toContain("gps.agenty.view");
    expect(anyOf).toContain("gps.van_selling.view");
    expect(anyOf).toContain("gps.trek.view");
    expect(matchRule("PUT", "/api/:slug/agent-route-days")).toBeNull();
    expect(matchRule("GET", "/api/:slug/agent-route-days/suggest")?.anyOf).toEqual(["gps.marshrut.view", "gps.marshrut.update"]);
  });

  it("tasks: list/create/update/cancel split, mobile skipped", () => {
    expect(matchRule("GET", "/api/:slug/tasks")?.anyOf).toEqual(["staff.zadachi_spisok.view"]);
    expect(matchRule("GET", "/api/:slug/tasks/:id")?.anyOf).toEqual(["staff.zadachi_spisok.view"]);
    expect(matchRule("GET", "/api/:slug/tasks/meta")?.anyOf).toContain("staff.zadachi_spisok.create");
    expect(matchRule("POST", "/api/:slug/tasks")?.anyOf).toEqual(["staff.zadachi_spisok.create"]);
    expect(matchRule("PATCH", "/api/:slug/tasks/:id")?.anyOf).toEqual(["staff.zadachi_spisok.update"]);
    expect(matchRule("POST", "/api/:slug/tasks/:id/cancel")?.anyOf).toEqual(["staff.zadachi_spisok.delete"]);
    expect(matchRule("POST", "/api/:slug/mobile/tasks/:id/complete")).toBeNull();
  });

  it("settings: mobile app, edit lock, workdays and geo split actions", () => {
    expect(matchRule("POST", "/api/:slug/settings/mobile-app-release/notify")?.anyOf).toEqual(["settings.mobile_app.transfer"]);
    expect(matchRule("POST", "/api/:slug/settings/mobile-app-release/upload")?.anyOf).toEqual(["settings.mobile_app.import"]);
    expect(matchRule("POST", "/api/:slug/settings/document-edit-lock/grants")?.anyOf).toEqual([
      "settings.document_edit_lock.assign"
    ]);
    expect(matchRule("PATCH", "/api/:slug/settings/document-edit-lock")?.anyOf).toEqual(["settings.document_edit_lock.update"]);
    expect(matchRule("POST", "/api/:slug/workdays/exceptions")?.anyOf).toEqual(["staff.rabochie_dni.create"]);
    expect(matchRule("PUT", "/api/:slug/workdays/enforce-access")?.anyOf).toEqual(["staff.rabochie_dni.status"]);
    expect(matchRule("PUT", "/api/:slug/workdays/schedules")?.anyOf).toEqual(["staff.rabochie_dni.update"]);
    expect(matchRule("DELETE", "/api/:slug/workdays/exceptions/:id")?.anyOf).toEqual(["staff.rabochie_dni.delete"]);
    expect(matchRule("DELETE", "/api/:slug/geo-boundaries/:id")?.anyOf).toEqual(["settings.geo_granitsy.void"]);
    expect(matchRule("POST", "/api/:slug/geo-boundaries/:id/assign-clients")?.anyOf).toEqual(["settings.geo_granitsy.assign"]);
  });

  it("territory check-in validation and GET /territories stay open", () => {
    expect(matchRule("POST", "/api/:slug/territories/:id/validate-checkin")).toBeNull();
    expect(matchRule("GET", "/api/:slug/territories")).toBeNull();
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

  it("does not apply web clients.create to mobile supervisor/agent client create paths", () => {
    expect(matchRule("POST", "/api/:slug/mobile/supervisor/clients")).toBeNull();
    expect(matchRule("POST", "/api/:slug/mobile/clients")).toBeNull();
    expect(matchRule("POST", "/api/aksit/mobile/supervisor/clients")).toBeNull();
    // Agar routeOptions faqat /clients bo'lsa — veb qoida (rawUrl guard alohida kesadi)
    expect(matchRule("POST", "/clients")?.anyOf).toContain("clients.klient.create");
  });

  it("mobile orders/payments paths do not match web CRUD when full path has /mobile/", () => {
    expect(matchRule("POST", "/api/:slug/mobile/orders/create")).toBeNull();
    expect(matchRule("POST", "/api/:slug/mobile/orders/enqueue")).toBeNull();
    expect(matchRule("POST", "/api/:slug/mobile/payments/order-cash-in")).toBeNull();
    expect(matchRule("POST", "/api/:slug/mobile/clients/:id/photo-reports")).toBeNull();
    // Stripped routeOptions collision risk (guard must use request.url)
    expect(matchRule("POST", "/orders")?.anyOf).toContain("orders.sozdanie.create");
    expect(matchRule("POST", "/payments")?.anyOf).toContain("cash.oplaty_klientov.create");
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
