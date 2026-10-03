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
      "clients.vizity_agent.update",
      "clients.vizity_dni.update",
      "clients.vizity_ekspeditor.update",
      "clients.vizity_sklad.update",
      "clients.vizity_kassa.update",
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
    expect(keys.has("clients.vizity.update")).toBe(false);
  });

  it("«Назначение визитов на карте» — ko'rish + 5 ta alohida tugma", () => {
    const clients = buildAccessOperationsTree().find((m) => m.sections.some((s) => s.id.startsWith("clients.")));
    const vp = clients?.sections.filter((s) => s.label === "Назначение визитов на карте") ?? [];
    expect(vp).toHaveLength(1);
    expect(vp[0]!.operations.map((o) => o.label)).toEqual([
      "Просмотр карты назначения визитов",
      "Привязать агента к клиентам на карте",
      "Назначить дни визитов на карте",
      "Назначить экспедитора на карте",
      "Назначить склад на карте",
      "Назначить кассу на карте"
    ]);
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

  it("xarita: har bir tugma faqat o'z maydonini ochadi, viloyatni emas", () => {
    const sklad = hasOf("clients.vizity_sklad.update");
    expect(missingClientBulkPermissions([{ warehouse_id: 2, zone: "Z" }], sklad)).toEqual([]);
    expect(missingClientBulkPermissions([{ cash_desk_id: 3 }], sklad)).toEqual(["clients.gr_sklad_kassa.update"]);
    expect(missingClientBulkPermissions([{ region: "R" }], sklad)).toEqual(["clients.gr_territoriya.update"]);
    expect(missingClientBulkPermissions([{ cash_desk_id: 3 }], hasOf("clients.vizity_kassa.update"))).toEqual([]);
  });

  it("xarita merge: slot maydonlari agent / kunlar / ekspeditor kalitlariga bo'linadi", () => {
    const merge = (slot: Record<string, unknown>) => [{ agent_assignments: [{ slot: 1, ...slot }], agent_assignments_merge: true }];
    const agent = hasOf("clients.vizity_agent.update");
    expect(missingClientBulkPermissions(merge({ agent_id: 5 }), agent)).toEqual([]);
    expect(missingClientBulkPermissions(merge({ visit_weekdays: [1] }), agent)).toEqual(["clients.vizity_dni.update"]);
    expect(missingClientBulkPermissions(merge({ expeditor_user_id: 7 }), agent)).toEqual(["clients.vizity_ekspeditor.update"]);
    expect(missingClientBulkPermissions(merge({ visit_weekdays: [2] }), hasOf("clients.vizity_dni.update"))).toEqual([]);
  });

  it("merge'siz agent_assignments (to'liq almashtirish) — komanda yoki uchala kalit", () => {
    const full = [{ agent_assignments: [{ slot: 1, agent_id: 5 }] }];
    expect(missingClientBulkPermissions(full, hasOf("clients.vizity_agent.update"))).toEqual([
      "clients.vizity_dni.update",
      "clients.vizity_ekspeditor.update"
    ]);
    expect(missingClientBulkPermissions(full, hasOf("clients.gr_komanda.update"))).toEqual([]);
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
