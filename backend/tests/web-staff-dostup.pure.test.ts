import { describe, expect, it } from "vitest";
import { expandPermissionKeyAliases } from "../src/modules/access/legacy-key-map";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";
import { buildRoleDefaultKeys } from "../src/modules/access/role-permission-presets";
import { matchRule } from "../src/modules/access/route-permission-guard";

const WEB_ROLES = ["cashier", "operator", "supervisor", "skladchik"] as const;

function applyDeny(keys: string[], denied: string[]): Set<string> {
  const effective = new Set(keys);
  for (const k of expandPermissionKeyAliases(denied)) effective.delete(k);
  return effective;
}

function can(keys: Set<string>, method: string, path: string): boolean {
  const rule = matchRule(method, path);
  if (!rule) return true;
  return rule.anyOf.some((k) => keys.has(k));
}

describe("web staff (kassir/operator/SVR/skladchik) — Dostup cheklovlari", () => {
  it("to‘rt rol presetlari mavjud va bo‘sh emas", () => {
    for (const role of WEB_ROLES) {
      expect(buildRoleDefaultKeys(role).length, role).toBeGreaterThan(0);
    }
  });

  it("yangi sozlama/aktivlik kalitlari katalogda", () => {
    const keys = new Set(buildStructuredPermissionCatalog().map((e) => e.key));
    for (const k of [
      "settings.mobile_app.view",
      "settings.system_migration.view",
      "settings.document_edit_lock.view",
      "settings.appearance.view",
      "settings.timezone.view",
      "settings.initial_setup.view",
      "settings.returns_filter.view",
      "settings.orders_consignment.view",
      "settings.web_staff_positions.view",
      "activity.history.view",
      "clients.foto.view"
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
  });

  it("kassir — kassa bor, ombor yozish va dostup yo‘q", () => {
    const k = buildRoleDefaultKeys("cashier");
    expect(k).toContain("cash.oplaty_klientov.view");
    expect(k).toContain("cash.oplaty_klientov.create");
    expect(k.some((x) => x.startsWith("warehouse.postuplenie.create"))).toBe(false);
    expect(k.some((x) => x.startsWith("access."))).toBe(false);
    expect(k).not.toContain("settings.mobile_app.view");
  });

  it("operator — buyurtma/mijoz bor, kassa/ombor/dostup yo‘q", () => {
    const k = buildRoleDefaultKeys("operator");
    expect(k).toContain("orders.sozdanie.create");
    expect(k).toContain("clients.klient.view");
    expect(k.some((x) => x.startsWith("cash."))).toBe(false);
    expect(k.some((x) => x.startsWith("warehouse."))).toBe(false);
    expect(k.some((x) => x.startsWith("access."))).toBe(false);
  });

  it("SVR (supervisor) — work-slots va GPS bor, kassa yozish yo‘q", () => {
    const k = buildRoleDefaultKeys("supervisor");
    expect(k).toContain("work_slots.raboche_mesto.view");
    expect(k).toContain("gps.agenty.view");
    expect(k).toContain("gps.marshrut.update");
    expect(k).toContain("clients.foto.view");
    expect(k).not.toContain("cash.oplaty_klientov.create");
    expect(k.some((x) => x.startsWith("access."))).toBe(false);
  });

  it("skladchik — ombor operatsiyalari bor, kassa va dostup yo‘q", () => {
    const k = buildRoleDefaultKeys("skladchik");
    expect(k).toContain("warehouse.postuplenie.create");
    expect(k).toContain("warehouse.peremeshchenie.transfer");
    expect(k.some((x) => x.startsWith("cash."))).toBe(false);
    expect(k).not.toContain("warehouse.sklady.create");
    expect(k.some((x) => x.startsWith("access."))).toBe(false);
  });

  it("Dostup deny — kassir to‘lovlarini yopadi", () => {
    const keys = applyDeny(buildRoleDefaultKeys("cashier"), ["cash.oplaty_klientov.view"]);
    expect(keys.has("cash.oplaty_klientov.view")).toBe(false);
    expect(can(keys, "GET", "/api/:slug/payments")).toBe(false);
    expect(can(new Set(buildRoleDefaultKeys("cashier")), "GET", "/api/:slug/payments")).toBe(true);
  });

  it("Dostup deny — operator buyurtma yaratishni yopadi", () => {
    const keys = applyDeny(buildRoleDefaultKeys("operator"), [
      "orders.sozdanie.create",
      "orders.vozvrat_polki.create",
      "orders.vozvrat_po_zakazu.create"
    ]);
    expect(can(keys, "POST", "/api/:slug/orders")).toBe(false);
    expect(can(new Set(buildRoleDefaultKeys("operator")), "POST", "/api/:slug/orders")).toBe(true);
    expect(can(keys, "GET", "/api/:slug/orders")).toBe(true);
  });

  it("Dostup deny — SVR work-slots ni yopadi", () => {
    const keys = applyDeny(buildRoleDefaultKeys("supervisor"), ["work_slots.raboche_mesto.view"]);
    expect(can(keys, "GET", "/api/:slug/work-slots")).toBe(false);
    expect(can(new Set(buildRoleDefaultKeys("supervisor")), "GET", "/api/:slug/work-slots")).toBe(true);
  });

  it("Dostup deny — skladchik kirimni yopadi", () => {
    const keys = applyDeny(buildRoleDefaultKeys("skladchik"), ["warehouse.postuplenie.create"]);
    expect(can(keys, "POST", "/api/:slug/goods-receipts")).toBe(false);
    expect(can(new Set(buildRoleDefaultKeys("skladchik")), "POST", "/api/:slug/goods-receipts")).toBe(true);
  });

  it("kassir ombor kirimini ocholmaydi; skladchik to‘lov yarata olmaydi", () => {
    const cashier = new Set(buildRoleDefaultKeys("cashier"));
    const sklad = new Set(buildRoleDefaultKeys("skladchik"));
    expect(can(cashier, "POST", "/api/:slug/goods-receipts")).toBe(false);
    expect(can(sklad, "POST", "/api/:slug/payments")).toBe(false);
    expect(can(new Set(buildRoleDefaultKeys("operator")), "GET", "/api/:slug/payments")).toBe(false);
  });

  it("fotootchet va geo-chegaralar alohida kalitga bog‘langan", () => {
    expect(matchRule("GET", "/api/:slug/clients/:id/photo-reports")?.anyOf).toEqual(["clients.foto.view"]);
    expect(matchRule("POST", "/api/:slug/clients/:id/photo-reports/:photoId/restore")?.anyOf).toContain(
      "clients.foto.restore"
    );
    expect(matchRule("GET", "/api/:slug/geo-boundaries")?.anyOf).toContain("settings.geo_granitsy.view");
    expect(matchRule("GET", "/api/:slug/dashboard/supervisor/photo-reports")?.anyOf).toContain("clients.foto.view");
  });

  it("operator — staff/kassa/sklad defaultda yopiq; grant ochadi, deny yopadi", () => {
    const op = new Set(buildRoleDefaultKeys("operator"));
    expect(can(op, "GET", "/api/:slug/agents")).toBe(false);
    expect(can(op, "GET", "/api/:slug/cash-desks")).toBe(false);
    expect(can(op, "GET", "/api/:slug/warehouses")).toBe(false);
    expect(can(op, "GET", "/api/:slug/orders")).toBe(true);

    const withAgents = new Set([...op, "staff.agent.view"]);
    expect(can(withAgents, "GET", "/api/:slug/agents")).toBe(true);
    expect(can(applyDeny([...withAgents], ["staff.agent.view"]), "GET", "/api/:slug/agents")).toBe(false);

    const withCash = new Set([...op, "cash.kassa.view"]);
    expect(can(withCash, "GET", "/api/:slug/cash-desks")).toBe(true);
    expect(can(applyDeny([...withCash], ["cash.kassa.view"]), "GET", "/api/:slug/cash-desks")).toBe(false);
  });

  it("manager — hisobot bor, dostup yo‘q; deny hisobotni yopadi", () => {
    const k = buildRoleDefaultKeys("manager");
    expect(k.some((x) => x.startsWith("reports."))).toBe(true);
    expect(k.some((x) => x.startsWith("access."))).toBe(false);
    expect(can(new Set(k), "GET", "/api/:slug/orders")).toBe(true);
    const denied = applyDeny(k, ["orders.zakaz.view", "orders.view"]);
    expect(can(denied, "GET", "/api/:slug/orders")).toBe(false);
  });

  it("director — dashboard/hisobot bor, dostup boshqaruv yo‘q", () => {
    const k = buildRoleDefaultKeys("director");
    expect(k).toContain("dashboard.prodazhi.view");
    expect(k).not.toContain("access.manage");
    expect(k.some((x) => x.startsWith("access."))).toBe(false);
    expect(can(new Set(k), "GET", "/api/:slug/dashboard/sales")).toBe(true);
  });

  it("regional_manager — buyurtma ko‘rish bor, yaratish yo‘q", () => {
    const k = new Set(buildRoleDefaultKeys("regional_manager"));
    expect(can(k, "GET", "/api/:slug/orders")).toBe(true);
    expect(can(k, "POST", "/api/:slug/orders")).toBe(false);
    const granted = new Set([...k, "orders.sozdanie.create"]);
    expect(can(granted, "POST", "/api/:slug/orders")).toBe(true);
  });

  it("kassir — kassa ochiq; grant omborni ochadi, olib tashlash yopadi", () => {
    const k = buildRoleDefaultKeys("cashier");
    expect(can(new Set(k), "GET", "/api/:slug/payments")).toBe(true);
    expect(can(new Set(k), "GET", "/api/:slug/warehouses")).toBe(false);
    const withWh = new Set([...k, "warehouse.sklady.view"]);
    expect(can(withWh, "GET", "/api/:slug/warehouses")).toBe(true);
    expect(can(applyDeny([...withWh], ["warehouse.sklady.view"]), "GET", "/api/:slug/warehouses")).toBe(false);
  });
});
