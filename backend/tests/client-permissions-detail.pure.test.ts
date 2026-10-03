import { describe, expect, it } from "vitest";
import { buildAccessOperationsTree } from "../src/modules/access/access-operations-tree";
import { matchRule } from "../src/modules/access/route-permission-guard";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";
import { missingClientBulkPermissions } from "../src/modules/clients/client-bulk-permissions";

const hasOf = (...keys: string[]) => {
  const s = new Set(keys);
  return (k: string) => s.has(k);
};

describe("Клиенты — Доступ katalogi", () => {
  const keys = new Set(buildStructuredPermissionCatalog().map((e) => e.key));

  it("mijozni o'chirish yo'q, faqat aktivlash/deaktivlash", () => {
    expect(keys.has("clients.klient.delete")).toBe(false);
    expect(keys.has("clients.klient.assign")).toBe(false);
    expect(keys.has("clients.klient.activate")).toBe(true);
    expect(keys.has("clients.klient.deactivate")).toBe(true);
  });

  it("sidebar bo'limlari va групповая обработка alohida operatsiyalar", () => {
    for (const k of [
      "clients.karta.view",
      "clients.vizity.view",
      "clients.vizity.update",
      "clients.obedinenie.history",
      "clients.oborudovanie.create",
      "clients.oborudovanie.delete",
      "clients.foto.void",
      "clients.foto.restore",
      "clients.ostatki_tt.view",
      "clients.ostatki_tt.import",
      "clients.ostatki_tt.copy",
      "clients.gr_komanda.update",
      "clients.gr_territoriya.update",
      "clients.gr_tegi.update"
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
    expect(keys.has("clients.oborudovanie.update")).toBe(false);
  });

  it("daraxtda «Групповая обработка» bo'limi 11 ta operatsiya bilan", () => {
    const clients = buildAccessOperationsTree().find((m) => m.sections.some((s) => s.id.startsWith("clients.")));
    const labels = clients?.sections.map((s) => s.label) ?? [];
    for (const l of [
      "Клиенты",
      "Групповая обработка",
      "Клиенты на карте",
      "Назначение визитов на карте",
      "Объединение клиентов",
      "Оборудование",
      "Фотоотчёты",
      "Остатки в торговых точках"
    ]) {
      expect(labels, l).toContain(l);
    }
    const group = clients?.sections.find((s) => s.label === "Групповая обработка");
    expect(group?.operations.length).toBe(11);
  });
});

describe("missingClientBulkPermissions", () => {
  it("har bir maydon guruhi o'z ruxsatini talab qiladi", () => {
    expect(missingClientBulkPermissions([{ category: "A" }], hasOf("clients.gr_kategoriya.update"))).toEqual([]);
    expect(missingClientBulkPermissions([{ category: "A", price_type: "x" }], hasOf("clients.gr_kategoriya.update"))).toEqual([
      "clients.gr_tip_tseny.update"
    ]);
  });

  it("vizity.update agent/zona/ombor/kassani o'zgartira oladi, viloyatni emas", () => {
    const has = hasOf("clients.vizity.update");
    expect(missingClientBulkPermissions([{ agent_id: 1, zone: "Z", warehouse_id: 2, cash_desk_id: 3 }], has)).toEqual([]);
    expect(missingClientBulkPermissions([{ region: "R" }], has)).toEqual(["clients.gr_territoriya.update"]);
  });

  it("is_active: true → activate, false → deactivate", () => {
    expect(missingClientBulkPermissions([{ is_active: false }], hasOf("clients.klient.activate"))).toEqual([
      "clients.klient.deactivate"
    ]);
    expect(missingClientBulkPermissions([{ is_active: true }], hasOf("clients.klient.activate"))).toEqual([]);
  });

  it("noma'lum maydon → klient.update, undefined e'tiborsiz", () => {
    expect(missingClientBulkPermissions([{ client_code: "1", zone: undefined }], hasOf())).toEqual(["clients.klient.update"]);
  });
});

describe("Клиенты — route guard", () => {
  it("o'chirish route qoidasi yo'q, ommaviy tahrir gr_* kalitlari bilan", () => {
    expect(matchRule("DELETE", "/api/:slug/clients/:id")?.anyOf ?? []).not.toContain("clients.klient.delete");
    expect(matchRule("PATCH", "/api/:slug/clients/bulk")?.anyOf).toContain("clients.gr_kanal.update");
    expect(matchRule("PATCH", "/api/:slug/clients/bulk-active")?.anyOf).toEqual([
      "clients.klient.activate",
      "clients.klient.deactivate"
    ]);
    expect(matchRule("POST", "/api/:slug/clients/bulk-tags")?.anyOf).toEqual(["clients.gr_tegi.update"]);
  });

  it("birlashtirish, uskunalar, foto, audit", () => {
    expect(matchRule("POST", "/api/:slug/clients/merge")?.anyOf).toEqual(["clients.obedinenie.update"]);
    expect(matchRule("POST", "/api/:slug/clients/saved-duplicate-groups")?.anyOf).toEqual(["clients.obedinenie.create"]);
    expect(matchRule("DELETE", "/api/:slug/clients/saved-duplicate-groups/:id")?.anyOf).toEqual(["clients.obedinenie.delete"]);
    expect(matchRule("GET", "/api/:slug/clients/merge-sessions")?.anyOf).toEqual(["clients.obedinenie.history"]);
    expect(matchRule("POST", "/api/:slug/clients/:id/equipment/:id/remove")?.anyOf).toEqual(["clients.oborudovanie.delete"]);
    expect(matchRule("POST", "/api/:slug/clients/:id/equipment")?.anyOf).toEqual(["clients.oborudovanie.create"]);
    expect(matchRule("GET", "/api/:slug/equipment")?.anyOf).toEqual(["clients.oborudovanie.view"]);
    expect(matchRule("DELETE", "/api/:slug/clients/:id/photo-reports/:id")?.anyOf).toEqual(["clients.foto.void"]);
    expect(matchRule("GET", "/api/:slug/clients/:id/audit")?.anyOf).toEqual(["clients.klient.history"]);
  });

  it("xarita/vizitlar ro'yxati va остатки в ТТ", () => {
    const list = matchRule("GET", "/api/:slug/clients")?.anyOf;
    expect(list).toEqual(expect.arrayContaining(["clients.klient.view", "clients.karta.view", "clients.vizity.view"]));
    expect(matchRule("GET", "/api/:slug/retail-stock")?.anyOf).toEqual(["clients.ostatki_tt.view"]);
    expect(matchRule("POST", "/api/:slug/retail-stock/upload")?.anyOf).toEqual(["clients.ostatki_tt.import"]);
    expect(matchRule("GET", "/api/:slug/retail-stock/export")?.anyOf).toEqual(["clients.ostatki_tt.copy"]);
  });
});
