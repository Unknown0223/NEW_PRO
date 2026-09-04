import { describe, expect, it } from "vitest";
import { matchRule } from "../src/modules/access/route-permission-guard";

/** RBAC guard qamrovi — asosiy biznes API prefikslari. */
const COVERED_SAMPLES: Array<{ method: string; path: string; key: string }> = [
  { method: "GET", path: "/api/:slug/dashboard/sales/summary", key: "dashboard.prodazhi.view" },
  { method: "GET", path: "/api/:slug/reports/wdr/builder", key: "reports.otchety.view" },
  { method: "GET", path: "/api/:slug/bonus-rules", key: "settings.bonusy_i_skidki.view" },
  { method: "POST", path: "/api/:slug/bonus-rules", key: "settings.bonusy_i_skidki.create" },
  { method: "GET", path: "/api/:slug/refusals", key: "orders.obmen_i_otkaz.view" },
  { method: "GET", path: "/api/:slug/audit-events", key: "audit.log.view" },
  { method: "GET", path: "/api/:slug/access/users", key: "access.upravlenie.view" },
  { method: "PATCH", path: "/api/:slug/access/users/1", key: "access.upravlenie.update" },
  { method: "GET", path: "/api/:slug/territory", key: "settings.territoriya.view" },
  { method: "GET", path: "/api/:slug/sales-directions", key: "settings.napravlenie_torgovli.view" },
  { method: "GET", path: "/api/:slug/linkage", key: "clients.klient.view" },
  { method: "GET", path: "/api/:slug/field/routes", key: "gps.gps.view" },
  { method: "GET", path: "/api/:slug/notifications", key: "staff.zadachi.view" },
  { method: "GET", path: "/api/:slug/orders/:id/approval", key: "orders.zakaz.view" },
  { method: "POST", path: "/api/:slug/orders/:id/approval/advance", key: "plans.ustanovka_planov.approve" },
  { method: "POST", path: "/api/:slug/agents/import.xlsx", key: "staff.agent.create" },
  { method: "GET", path: "/api/:slug/expeditors/import/template", key: "staff.ekspeditor.view" },
  { method: "POST", path: "/api/:slug/staff/import.xlsx", key: "staff.agent.create" },
  { method: "GET", path: "/api/:slug/clients/:id/photo-reports", key: "clients.foto.view" },
  { method: "GET", path: "/api/:slug/geo-boundaries", key: "settings.geo_granitsy.view" },
  { method: "GET", path: "/api/:slug/settings/mobile-app-release", key: "settings.mobile_app.view" },
  { method: "GET", path: "/api/:slug/settings/document-edit-lock", key: "settings.document_edit_lock.view" },
  { method: "GET", path: "/api/:slug/system-migration/inventory", key: "settings.system_migration.view" },
  { method: "GET", path: "/api/:slug/activity", key: "activity.history.view" }
];

describe("route-permission-guard coverage", () => {
  for (const sample of COVERED_SAMPLES) {
    it(`${sample.method} ${sample.path} → ${sample.key}`, () => {
      const rule = matchRule(sample.method, sample.path);
      expect(rule).not.toBeNull();
      expect(rule!.anyOf).toContain(sample.key);
    });
  }

  it("auth va health marshrutlari qoida talab qilmaydi", () => {
    expect(matchRule("POST", "/api/auth/login")).toBeNull();
    expect(matchRule("GET", "/health")).toBeNull();
    expect(matchRule("GET", "/api/:slug/access/me-permissions")).toBeNull();
  });

  it("mobil API veb CRUD kalitlarini talab qilmaydi", () => {
    expect(matchRule("GET", "/api/:slug/mobile/clients/:id/photo-reports")).toBeNull();
    expect(matchRule("POST", "/api/:slug/mobile/clients/:id/photo-reports")).toBeNull();
    expect(matchRule("GET", "/api/test1/mobile/clients/55/photo-reports")).toBeNull();
    expect(matchRule("GET", "/api/:slug/mobile/sync/full")).toBeNull();
    expect(matchRule("GET", "/api/:slug/clients/:id/photo-reports")?.anyOf).toContain("clients.foto.view");
  });
});
