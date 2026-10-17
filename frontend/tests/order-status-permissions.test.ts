import { describe, expect, it } from "vitest";
import { isFlatAccessModule, type AccessTreeModule } from "@/lib/access-operations-tree";
import {
  ORDER_STATUS_REOPEN_PERMISSION,
  ORDER_STATUS_REVERT_PERMISSION,
  canPickBulkTargetStatus,
  orderStatusTransitionPermission
} from "@/lib/order-status-transitions";

describe("orderStatusTransitionPermission (backend bilan bir xil)", () => {
  it("oldinga — maqsad status, orqaga — revert, bekorni tiklash — reopen", () => {
    expect(orderStatusTransitionPermission("new", "confirmed", "order")).toBe("orders.status_confirmed.status");
    expect(orderStatusTransitionPermission("delivering", "delivered", "order")).toBe("orders.status_delivered.status");
    expect(orderStatusTransitionPermission("picking", "cancelled", "order")).toBe("orders.status_cancelled.status");
    expect(orderStatusTransitionPermission("confirmed", "new", "order")).toBe(ORDER_STATUS_REVERT_PERMISSION);
    expect(orderStatusTransitionPermission("delivering", "confirmed", "return")).toBe(ORDER_STATUS_REVERT_PERMISSION);
    expect(orderStatusTransitionPermission("cancelled", "new", "order")).toBe(ORDER_STATUS_REOPEN_PERMISSION);
  });
});

describe("canPickBulkTargetStatus", () => {
  const only = (...keys: string[]) => (k: string) => keys.includes(k);

  it("faqat ruxsat berilgan maqsad statuslar", () => {
    const has = only("orders.status_delivered.status");
    expect(canPickBulkTargetStatus("delivered", has)).toBe(true);
    expect(canPickBulkTargetStatus("cancelled", has)).toBe(false);
    expect(canPickBulkTargetStatus("new", has)).toBe(false);
  });

  it("«Новый» — orqaga qadam yoki tiklash bilan; revert bekor qilishni ochmaydi", () => {
    expect(canPickBulkTargetStatus("new", only(ORDER_STATUS_REOPEN_PERMISSION))).toBe(true);
    expect(canPickBulkTargetStatus("picking", only(ORDER_STATUS_REVERT_PERMISSION))).toBe(true);
    expect(canPickBulkTargetStatus("cancelled", only(ORDER_STATUS_REVERT_PERMISSION))).toBe(false);
  });
});

describe("isFlatAccessModule", () => {
  const op = (key: string) => ({ key, action: "view" as const, label: key });

  it("hamma bo'lim bitta operatsiyali — tekis; aralash modulda bo'limlar saqlanadi", () => {
    const flat: AccessTreeModule = {
      id: "dash",
      label: "Дашборд",
      sections: [
        { id: "a", label: "A", operations: [op("dashboard.a.view")] },
        { id: "b", label: "B", operations: [op("dashboard.b.view")] }
      ]
    };
    const mixed: AccessTreeModule = {
      id: "cash",
      label: "Касса",
      sections: [
        { id: "x", label: "X", operations: [op("cash.x.view"), op("cash.x.create")] },
        { id: "y", label: "Приходы", operations: [op("cash.prihody.view")] }
      ]
    };
    expect(isFlatAccessModule(flat)).toBe(true);
    expect(isFlatAccessModule(mixed)).toBe(false);
  });
});
