import { describe, expect, it } from "vitest";
import {
  PERMISSION_ACTIONS,
  PERMISSION_SECTIONS,
  buildStructuredPermissionCatalog,
  extractAction,
  permissionKey
} from "../src/modules/access/permission-model";
import { mapLegacyKeyToStructured } from "../src/modules/access/legacy-key-map";
import { matchRule } from "../src/modules/access/route-permission-guard";
import { buildRoleDefaultKeys, rolesWithPresets } from "../src/modules/access/role-permission-presets";

describe("permission-model (CRUD struktura)", () => {
  it("har bir bo'lim faqat e'lon qilingan amal tiplari uchun kalit beradi", () => {
    const catalog = buildStructuredPermissionCatalog();
    for (const def of PERMISSION_SECTIONS) {
      for (const action of def.actions) {
        const key = permissionKey(def.module, def.section, action);
        expect(catalog.some((e) => e.key === key)).toBe(true);
      }
    }
  });

  it("har bir kalit <module>.<section>.<action> ko'rinishida va action to'g'ri", () => {
    for (const e of buildStructuredPermissionCatalog()) {
      expect(e.key).toBe(`${e.module}.${e.section}.${e.action}`);
      expect(PERMISSION_ACTIONS).toContain(e.action);
      expect(extractAction(e.key)).toBe(e.action);
    }
  });

  it("copy/activate/deactivate alohida tiplar — clients.klient da uchchalasi ham bor", () => {
    const keys = buildStructuredPermissionCatalog().map((e) => e.key);
    expect(keys).toContain("clients.klient.copy");
    expect(keys).toContain("clients.klient.activate");
    expect(keys).toContain("clients.klient.deactivate");
  });

  it("yangi bo'limlar mavjud (pivot/audit/finance/automation/work_slots/warehouse to'liq)", () => {
    const modules = new Set(PERMISSION_SECTIONS.map((s) => s.module));
    for (const m of ["pivot", "audit", "finance", "automation", "work_slots", "warehouse", "routes"]) {
      expect(modules.has(m), `module yo'q: ${m}`).toBe(true);
    }
    const whSections = PERMISSION_SECTIONS.filter((s) => s.module === "warehouse").map((s) => s.section);
    expect(whSections).toContain("peremeshchenie");
    expect(whSections).toContain("korrektirovka");
    expect(whSections).toContain("materialnyy_otchet");
  });

  it("kalitlar takrorlanmaydi", () => {
    const keys = buildStructuredPermissionCatalog().map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("legacy-key-map (eski → yangi)", () => {
  it("aktiv/neaktiv → activate/deactivate", () => {
    expect(mapLegacyKeyToStructured("staff.agent.deaktivirovat")).toBe("staff.agent.deactivate");
    expect(mapLegacyKeyToStructured("staff.inkassator.aktivirovat_deaktivirovat")).toBe("staff.inkassator.deactivate");
  });

  it("spisok/prosmotr → view, sozdat/dobavit → create, udalit → delete", () => {
    expect(mapLegacyKeyToStructured("clients.spisok_klientov")).toBe("clients.klient.view");
    expect(mapLegacyKeyToStructured("clients.dobavlenie_klienta")).toBe("clients.klient.create");
    expect(mapLegacyKeyToStructured("suppliers.udalenie_postavshchikov")).toBe("suppliers.postavshchik.delete");
  });

  it("excel/skachat → copy, import → import", () => {
    expect(mapLegacyKeyToStructured("clients.import_fayla_excel_klient")).toBe("clients.klient.import");
    expect(mapLegacyKeyToStructured("invoices.otgruzochnye_nakladnye.otgruzochnyy_nakladnoy_skachat_excel_217")).toBe(
      "invoices.otgruzochnye.copy"
    );
  });

  it("noma'lum kalit uchun null", () => {
    expect(mapLegacyKeyToStructured("nope")).toBeNull();
  });
});

describe("route-permission-guard matchRule", () => {
  it("orders write/read to'g'ri kalitга bog'lanadi", () => {
    expect(matchRule("POST", "/api/:slug/orders")?.anyOf).toContain("orders.zakaz.create");
    expect(matchRule("GET", "/api/:slug/orders")?.anyOf).toContain("orders.zakaz.view");
    expect(matchRule("PATCH", "/api/:slug/orders/:id")?.anyOf).toContain("orders.zakaz.update");
    expect(matchRule("DELETE", "/api/:slug/orders/:id")?.anyOf).toContain("orders.zakaz.delete");
  });

  it("maxsus yo'llar (status/bulk) umumiydan oldin", () => {
    expect(matchRule("POST", "/api/:slug/orders/:id/status")?.anyOf).toContain("orders.zakaz.status");
    expect(matchRule("POST", "/api/:slug/orders/bulk/nakladnoy")?.anyOf).toContain("orders.zakaz.copy");
  });

  it("clients bulk-active → activate/deactivate", () => {
    const rule = matchRule("POST", "/api/:slug/clients/bulk-active");
    expect(rule?.anyOf).toContain("clients.klient.activate");
    expect(rule?.anyOf).toContain("clients.klient.deactivate");
  });

  it("mos qoida yo'q bo'lsa null", () => {
    expect(matchRule("GET", "/api/:slug/health-xyz")).toBeNull();
  });
});

describe("role-permission-presets", () => {
  it("admin barcha strukturali kalitlarni + access.manage oladi", () => {
    const admin = buildRoleDefaultKeys("admin");
    expect(admin).toContain("access.manage");
    const catalogKeys = buildStructuredPermissionCatalog().map((e) => e.key);
    for (const k of catalogKeys) expect(admin).toContain(k);
  });

  it("agent — заказы/клиенты create bor, склад yo'q", () => {
    const agent = buildRoleDefaultKeys("agent");
    expect(agent).toContain("orders.zakaz.create");
    expect(agent).toContain("clients.klient.create");
    expect(agent.some((k) => k.startsWith("warehouse."))).toBe(false);
  });

  it("supervisor — activate bor, deactivate yo'q", () => {
    const sup = buildRoleDefaultKeys("supervisor");
    expect(sup).toContain("clients.klient.activate");
    expect(sup).not.toContain("clients.klient.deactivate");
  });

  it("presetlar bo'sh emas", () => {
    expect(rolesWithPresets().length).toBeGreaterThan(5);
    for (const role of rolesWithPresets()) {
      expect(buildRoleDefaultKeys(role).length).toBeGreaterThan(0);
    }
  });
});
