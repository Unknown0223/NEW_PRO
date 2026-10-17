import { describe, expect, it } from "vitest";
import { buildAccessOperationsTree } from "../src/modules/access/access-operations-tree";
import { expandPermissionKeyAliases } from "../src/modules/access/legacy-key-map";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";
import { buildRoleDefaultKeys } from "../src/modules/access/role-permission-presets";
import { ORDER_STATUSES, ORDER_TYPES, getAllowedNextStatuses } from "../src/modules/orders/order-status";
import {
  ORDER_STATUS_CHANGE_PERMISSIONS,
  ORDER_STATUS_DATE_PERMISSION,
  buildOrderStatusPermissionChecker,
  orderStatusTransitionPermission
} from "../src/modules/orders/order-status-permissions";

const CATALOG = new Set(buildStructuredPermissionCatalog().map((e) => e.key));

describe("orderStatusTransitionPermission", () => {
  it("oldinga o'tish — maqsad status kaliti", () => {
    expect(orderStatusTransitionPermission("new", "confirmed", "order")).toBe("orders.status_confirmed.status");
    expect(orderStatusTransitionPermission("confirmed", "picking", "order")).toBe("orders.status_picking.status");
    expect(orderStatusTransitionPermission("picking", "delivering", "order")).toBe("orders.status_delivering.status");
    expect(orderStatusTransitionPermission("delivering", "delivered", "order")).toBe("orders.status_delivered.status");
    expect(orderStatusTransitionPermission("delivered", "returned", "order")).toBe("orders.status_returned.status");
    expect(orderStatusTransitionPermission("picking", "cancelled", "order")).toBe("orders.status_cancelled.status");
    expect(orderStatusTransitionPermission("returned", "cancelled", "order")).toBe("orders.status_cancelled.status");
  });

  it("orqaga bir qadam — revert, bekorni tiklash — reopen", () => {
    expect(orderStatusTransitionPermission("confirmed", "new", "order")).toBe("orders.status_revert.status");
    expect(orderStatusTransitionPermission("delivered", "delivering", "order")).toBe("orders.status_revert.status");
    expect(orderStatusTransitionPermission("delivering", "confirmed", "return")).toBe("orders.status_revert.status");
    expect(orderStatusTransitionPermission("cancelled", "new", "order")).toBe("orders.status_reopen.status");
  });

  it("har bir ruxsat etilgan o'tish katalogdagi kalitga bog'lanadi", () => {
    for (const type of ORDER_TYPES) {
      for (const from of ORDER_STATUSES) {
        for (const to of getAllowedNextStatuses(from, { orderType: type })) {
          const key = orderStatusTransitionPermission(from, to, type);
          expect(key, `${type}: ${from} → ${to}`).not.toBeNull();
          expect(CATALOG.has(key!), `${type}: ${from} → ${to} = ${key}`).toBe(true);
        }
      }
    }
    for (const key of [...ORDER_STATUS_CHANGE_PERMISSIONS, ORDER_STATUS_DATE_PERMISSION]) {
      expect(CATALOG.has(key), key).toBe(true);
    }
  });

  it("checker faqat berilgan kalitlar bo'yicha ruxsat beradi", () => {
    const can = buildOrderStatusPermissionChecker(new Set(["orders.status_delivered.status"]));
    expect(can("delivering", "delivered", "order")).toBe(true);
    expect(can("delivering", "cancelled", "order")).toBe(false);
    expect(can("delivered", "delivering", "order")).toBe(false);
  });

  it("eski legacy status kalitlari yangi kalitlarga alias bo'ladi", () => {
    const keys = expandPermissionKeyAliases(["orders.status.izmenit_status_na_otgruzhen"]);
    expect(keys).toContain("orders.status_delivering.status");
  });

  it("operator preseti barcha status kalitlarini oladi, eski umumiy kalitlar yo'q", () => {
    const op = new Set(buildRoleDefaultKeys("operator"));
    for (const key of [...ORDER_STATUS_CHANGE_PERMISSIONS, ORDER_STATUS_DATE_PERMISSION]) expect(op.has(key), key).toBe(true);
    expect(CATALOG.has("orders.zakaz.status")).toBe(false);
    expect(CATALOG.has("orders.status.status")).toBe(false);
  });
});

describe("Доступ daraxti — Заявки", () => {
  const tree = buildAccessOperationsTree();
  const orders = tree.find((m) => m.label === "Заявки")!;

  it("statuslar bitta «Статус» bo'limida, «Заявки» ichida status yo'q", () => {
    const status = orders.sections.find((s) => s.label === "Статус")!;
    expect(status.operations.map((o) => o.key)).toEqual([...ORDER_STATUS_CHANGE_PERMISSIONS, ORDER_STATUS_DATE_PERMISSION]);
    const zakaz = orders.sections.find((s) => s.label === "Заявки")!;
    expect(zakaz.operations.some((o) => o.action === "status")).toBe(false);
  });

  it("«Другие операции» — накладные, экспедитор, консигнация; bo'lim tartibi saqlanadi", () => {
    expect(orders.sections.map((s) => s.label)).toEqual(["Заявки", "Отказы", "Автоматизация заявок", "Статус", "Другие операции"]);
    const other = orders.sections.find((s) => s.label === "Другие операции")!;
    expect(other.operations.map((o) => o.key)).toEqual([
      "orders.zakaz.copy",
      "orders.zakaz.assign",
      "orders.drugie_operacii.update"
    ]);
  });

  it("har bir kalit daraxtda bir marta, bo'lim nomlari modul ichida takrorlanmaydi", () => {
    const keys = tree.flatMap((m) => m.sections.flatMap((s) => s.operations.map((o) => o.key)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(CATALOG);
    for (const m of tree) {
      const labels = m.sections.map((s) => s.label);
      expect(new Set(labels).size, m.label).toBe(labels.length);
    }
  });

  it("takror bo'limlar (Финансы, Сводная таблица) katalogda yo'q", () => {
    expect(CATALOG.has("finance.obzor.view")).toBe(false);
    expect(CATALOG.has("pivot.otchety.view")).toBe(false);
    expect(expandPermissionKeyAliases(["finance.obzor.view"])).toContain("dashboard.finansy.view");
  });
});
