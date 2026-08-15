import { describe, expect, it } from "vitest";
import { humanizeAction, humanizeEntity, payloadDetailRows, summarizePayload } from "@/lib/history-labels";

describe("humanizeAction — texnik kod → tushunarli matn", () => {
  it("aniq mosliklar", () => {
    expect(humanizeAction("create")).toBe("Создание");
    expect(humanizeAction("payment.void")).toBe("Оплата удалена (в архив)");
    expect(humanizeAction("permissions.updated")).toBe("Изменение прав доступа");
    expect(humanizeAction("period_return")).toBe("Возврат за период");
    expect(humanizeAction("patch.bonus_stack")).toBe("Изменение бонусных настроек");
    expect(humanizeAction("schedule.matrix")).toBe("Плановое изменение цен");
    expect(humanizeAction("status_change")).toBe("Изменение статуса");
    expect(humanizeAction("page_view")).toBe("Просмотр страницы");
  });

  it("noma'lum kod uchun aqlli fallback", () => {
    expect(humanizeAction("something.create_new")).toBe("Создание");
    expect(humanizeAction("foo.delete_bar")).toBe("Удаление");
    expect(humanizeAction("xyz.patch_baz")).toBe("Изменение");
    expect(humanizeAction(null)).toBe("—");
  });
});

describe("humanizeEntity", () => {
  it("nom + id", () => {
    expect(humanizeEntity("order", 123)).toBe("Заказ #123");
    expect(humanizeEntity("finance", 7)).toBe("Оплата #7");
    expect(humanizeEntity("sales_return", "RET-1")).toBe("Возврат #RET-1");
    expect(humanizeEntity("user")).toBe("Сотрудник");
  });
});

describe("summarizePayload — qisqa tushunarli xulosa", () => {
  it("status o'zgarishi", () => {
    expect(summarizePayload({ from_status: "новый", to_status: "собран" })).toBe("статус: новый → собран");
  });
  it("patch maydonlari", () => {
    expect(summarizePayload({ patch: { name: "A", phone: "B" } })).toContain("изменено:");
  });
  it("oddiy maydonlar", () => {
    const s = summarizePayload({ amount: 50000, payment_type: "нал", client_id: 9 });
    expect(s).toContain("сумма:");
    expect(s).toMatch(/50\s?000/);
    expect(s).toContain("тип оплаты: нал");
  });
  it("zakaz lines flat audit — odam tilida", () => {
    const s = summarizePayload(
      { order_id: 13, total_sum: "160200", discount_alert: "not_applied", bonus_alert: null },
      "order.lines"
    );
    expect(s).toContain("Сумма:");
    expect(s).toMatch(/160\s?200/);
    expect(s).toContain("Скидка не применена");
    expect(s).not.toContain("order_id");
  });
  it("bo'sh payload", () => {
    expect(summarizePayload(null)).toBe("");
    expect(summarizePayload({})).toBe("");
  });
});

describe("payloadDetailRows — to'liq batafsil (ID/nomer/tip)", () => {
  it("barcha maydonlar yorliq bilan chiqadi", () => {
    const rows = payloadDetailRows({ client_id: 9, amount: 50000 });
    const map = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(map["клиент (ID)"]).toBe("9");
    expect(map["сумма"]).toMatch(/50\s?000/);
  });
  it("zakaz lines — alert va summa odam tilida, order_id yo'q", () => {
    const rows = payloadDetailRows({
      order_id: 13,
      total_sum: "160200",
      discount_alert: "not_applied"
    });
    const map = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(map["заказ (ID)"]).toBeUndefined();
    expect(map["Сумма"]).toMatch(/160\s?200/);
    expect(map["Проблема скидки"]).toBe("Скидка не применена");
  });
  it("ichki obyekt va massivlar", () => {
    const rows = payloadDetailRows({ patch: { name: "A" }, fields: ["a", "b"] });
    const map = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(map["fields"]).toBe("a, b");
    expect(map["patch"]).toContain("название: A");
  });
  it("bo'sh/yo'q qiymatlar tashlanadi", () => {
    expect(payloadDetailRows(null)).toEqual([]);
    expect(payloadDetailRows({ a: null, b: "" })).toEqual([]);
  });
});
