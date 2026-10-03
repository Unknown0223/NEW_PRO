import { describe, expect, it } from "vitest";
import { buildAccessOperationsTree } from "../src/modules/access/access-operations-tree";
import { matchRule } from "../src/modules/access/route-permission-guard";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";
import { buildRoleDefaultKeys } from "../src/modules/access/role-permission-presets";
import { orderCreatePermissionForType, returnCreatePermission } from "../src/modules/orders/order-create-permissions";
import { automationListPermission, automationPatchPermission } from "../src/modules/order-automation/order-automation.rbac";

const anyOf = (method: string, path: string) => matchRule(method, path)?.anyOf ?? [];

describe("Заявки — Доступ katalogi", () => {
  const keys = new Set(buildStructuredPermissionCatalog().map((e) => e.key));

  it("yaratish, qaytarish va obmen — «Заявки» bo'limi ichida alohida operatsiyalar", () => {
    const orders = buildAccessOperationsTree().find((m) => m.sections.some((s) => s.id.startsWith("orders.")));
    const labels = orders?.sections.map((s) => s.label) ?? [];
    for (const l of ["Заявки", "Отказы", "Автоматизация заявок", "Статус"]) expect(labels, l).toContain(l);
    for (const l of ["Создать заказ", "Создать возврат с полки", "Создать возврат с полки по заказу", "Создать обмен"]) {
      expect(labels, l).not.toContain(l);
    }
    const zakaz = orders!.sections.find((s) => s.label === "Заявки")!;
    expect(zakaz.operations.map((o) => o.key)).toEqual([
      "orders.zakaz.view",
      "orders.zakaz.update",
      "orders.zakaz.export",
      "orders.zakaz.history",
      "orders.sozdanie.create",
      "orders.vozvrat_polki.create",
      "orders.vozvrat_po_zakazu.create",
      "orders.obmen.create"
    ]);
  });

  it("Excel yuklab olish har bo'limda alohida ruxsat", () => {
    for (const k of ["orders.zakaz.export", "orders.otkazy.export", "orders.avtomatizatsiya.export"]) {
      expect(keys.has(k), k).toBe(true);
    }
    expect(keys.has("orders.avtomatizatsiya.copy")).toBe(false);
    expect(new Set(buildRoleDefaultKeys("operator")).has("orders.zakaz.export")).toBe(true);
  });

  it("eski umumiy kalitlar va ishlamaydigan «Удаление заказа» yo'q", () => {
    for (const k of [
      "orders.zakaz.create",
      "orders.zakaz.delete",
      "orders.vozvrat.create",
      "orders.vozvrat.view",
      "orders.obmen_i_otkaz.create",
      "orders.obmen_i_otkaz.view",
      "automation.zaiavki.view",
      "automation.zaiavki.update"
    ]) {
      expect(keys.has(k), k).toBe(false);
    }
    for (const k of [
      "orders.sozdanie.create",
      "orders.vozvrat_polki.create",
      "orders.vozvrat_po_zakazu.create",
      "orders.obmen.create",
      "orders.otkazy.view",
      "orders.avtomatizatsiya.delete",
      "orders.avtomatizatsiya.restore",
      "orders.avtomatizatsiya.activate",
      "orders.avtomatizatsiya.deactivate",
      "orders.avtomatizatsiya.export",
      "invoices.vozvratnye.approve"
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
  });

  it("rol presetlari yangi yaratish kalitlarini oladi", () => {
    const operator = buildRoleDefaultKeys("operator");
    expect(operator).toContain("orders.sozdanie.create");
    expect(operator).toContain("orders.vozvrat_po_zakazu.create");
    expect(operator).not.toContain("orders.obmen.create");
    expect(buildRoleDefaultKeys("expeditor")).not.toContain("orders.sozdanie.create");
  });
});

describe("Заявки — server tekshiruvi", () => {
  it("POST /orders — `order_type` bo'yicha alohida kalit", () => {
    expect(orderCreatePermissionForType(undefined)).toBe("orders.sozdanie.create");
    expect(orderCreatePermissionForType("order")).toBe("orders.sozdanie.create");
    expect(orderCreatePermissionForType("exchange")).toBe("orders.obmen.create");
    expect(orderCreatePermissionForType("return")).toBe("orders.vozvrat_polki.create");
    expect(orderCreatePermissionForType("return_by_order")).toBe("orders.vozvrat_po_zakazu.create");
  });

  it("polki qaytarish: zakaz bo'yicha / davr bo'yicha", () => {
    expect(returnCreatePermission(15)).toBe("orders.vozvrat_po_zakazu.create");
    expect(returnCreatePermission(undefined)).toBe("orders.vozvrat_polki.create");
    expect(anyOf("POST", "/api/:slug/returns/period-batch")).toEqual(["orders.vozvrat_polki.create"]);
    expect(anyOf("POST", "/api/:slug/returns/full-order")).toEqual(["orders.vozvrat_po_zakazu.create"]);
    expect(anyOf("GET", "/api/:slug/returns/shelf-return-by-order/check")).toEqual(["orders.vozvrat_po_zakazu.create"]);
  });

  it("yaratish sahifalari «Заявки» ro'yxatini ko'rish ruxsatisiz ham ishlaydi", () => {
    expect(anyOf("GET", "/api/:slug/orders/create-context")).toContain("orders.obmen.create");
    expect(anyOf("GET", "/api/:slug/returns/client-data")).toContain("orders.vozvrat_polki.create");
    expect(anyOf("GET", "/api/:slug/orders")).toContain("orders.vozvrat_po_zakazu.create");
    expect(anyOf("GET", "/api/:slug/orders/:id(\\d+)")).toEqual(["orders.zakaz.view"]);
  });

  it("qaytarishni qabul qilish — «Возвратные накладные»", () => {
    expect(anyOf("POST", "/api/:slug/returns/daily-waybills/:courierId/:date/accept")).toEqual(["invoices.vozvratnye.approve"]);
    expect(anyOf("POST", "/api/:slug/returns/:id/reject")).toEqual(["invoices.vozvratnye.approve"]);
    expect(anyOf("GET", "/api/:slug/returns/daily-waybills")).toEqual(["invoices.vozvratnye.view"]);
  });

  it("avtomatizatsiya: o'chirish, tiklash, Excel, aktiv/deaktiv alohida", () => {
    expect(anyOf("DELETE", "/api/:slug/order-restriction-rules/:id")).toEqual(["orders.avtomatizatsiya.delete"]);
    expect(anyOf("POST", "/api/:slug/order-auto-confirm-rules/:id/restore")).toEqual(["orders.avtomatizatsiya.restore"]);
    expect(anyOf("POST", "/api/:slug/order-auto-confirm-rules/:id/duplicate")).toEqual(["orders.avtomatizatsiya.create"]);
    expect(anyOf("GET", "/api/:slug/order-restriction-rules")).toContain("orders.avtomatizatsiya.view");
    expect(automationPatchPermission({ is_active: false })).toBe("orders.avtomatizatsiya.deactivate");
    expect(automationPatchPermission({ is_active: true })).toBe("orders.avtomatizatsiya.activate");
    expect(automationPatchPermission({ name: "x", is_active: true })).toBe("orders.avtomatizatsiya.update");
    expect(automationListPermission({ export: "csv" })).toBe("orders.avtomatizatsiya.export");
    expect(automationListPermission({ page: "1" })).toBe("orders.avtomatizatsiya.view");
  });

  it("«Отказы» — alohida bo'lim", () => {
    expect(anyOf("GET", "/api/:slug/refusals")).toEqual(["orders.otkazy.view"]);
    expect(anyOf("POST", "/api/:slug/refusals")).toEqual(["orders.otkazy.create"]);
  });
});
