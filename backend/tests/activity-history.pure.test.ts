import { describe, expect, it } from "vitest";
import {
  buildStructuredPermissionCatalog,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABEL_RU
} from "../src/modules/access/permission-model";
import {
  ACTIVITY_EVENT_TYPES,
  isActivityEventType,
  isTrackedModule,
  resolveEntityHistory
} from "../src/modules/activity/activity.constants";

describe("history amal tipi (permission catalog)", () => {
  it("`history` PERMISSION_ACTIONS ichida va RU label bor", () => {
    expect(PERMISSION_ACTIONS).toContain("history");
    expect(PERMISSION_ACTION_LABEL_RU.history).toBe("История");
  });

  it("asosiy bo'limlarда `<module>.<section>.history` kaliti mavjud", () => {
    const keys = new Set(buildStructuredPermissionCatalog().map((e) => e.key));
    for (const k of [
      "orders.zakaz.history",
      "clients.klient.history",
      "staff.agent.history",
      "cash.oplaty_klientov.history",
      "warehouse.postuplenie.history",
      "suppliers.postavshchik.history",
      "settings.tovar.history",
      "access.upravlenie.history"
    ]) {
      expect(keys.has(k), `kalit yo'q: ${k}`).toBe(true);
    }
  });

  it("har bir history kaliti `.history` bilan tugaydi", () => {
    for (const e of buildStructuredPermissionCatalog()) {
      if (e.action === "history") expect(e.key.endsWith(".history")).toBe(true);
    }
  });
});

describe("activity konstantalari", () => {
  it("event tiplari to'g'ri tekshiriladi", () => {
    expect(ACTIVITY_EVENT_TYPES).toContain("page_view");
    expect(ACTIVITY_EVENT_TYPES).toContain("form_abandon");
    expect(isActivityEventType("page_view")).toBe(true);
    expect(isActivityEventType("nope")).toBe(false);
    expect(isActivityEventType(123)).toBe(false);
  });

  it("faqat oq ro'yxatdagi modullar kuzatiladi", () => {
    expect(isTrackedModule("orders")).toBe(true);
    expect(isTrackedModule("clients")).toBe(true);
    expect(isTrackedModule("warehouse")).toBe(true);
    expect(isTrackedModule("pivot")).toBe(false);
    expect(isTrackedModule(null)).toBe(false);
  });

  it("entity tipi → descriptor (permission + manbalar)", () => {
    const order = resolveEntityHistory("order");
    expect(order?.permissionHistory).toBe("orders.zakaz.history");
    expect(order?.permissionView).toBe("orders.zakaz.view");
    expect(order?.auditEntityTypes).toContain("order");
    expect(order?.sources).toContain("orderStatus");
    expect(order?.sources).toContain("orderChange");

    const client = resolveEntityHistory("client");
    expect(client?.permissionHistory).toBe("clients.klient.history");
    expect(client?.sources).toContain("clientAudit");

    const staff = resolveEntityHistory("user");
    expect(staff?.permissionHistory).toBe("staff.agent.history");
    expect(staff?.sources).toContain("accessLog");

    expect(resolveEntityHistory("unknown_xyz")).toBeNull();
  });

  it("to'lov tarixi audit'da `finance` deb yoziladi", () => {
    const payment = resolveEntityHistory("payment");
    expect(payment?.module).toBe("cash");
    expect(payment?.section).toBe("oplaty_klientov");
    expect(payment?.permissionHistory).toBe("cash.oplaty_klientov.history");
    expect(payment?.auditEntityTypes).toContain("finance");
    expect(payment?.activityEntityTypes).toContain("payment");
  });

  it("qaytarish tarixi `sales_return` entity bilan", () => {
    for (const key of ["sales_return", "return"]) {
      const ret = resolveEntityHistory(key);
      expect(ret?.module).toBe("orders");
      expect(ret?.section).toBe("vozvrat");
      expect(ret?.permissionHistory).toBe("orders.vozvrat.history");
      expect(ret?.auditEntityTypes).toContain("sales_return");
    }
  });
});
