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
  { method: "POST", path: "/api/:slug/orders/:id/approval/advance", key: "plans.ustanovka_planov.approve" }
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
});
