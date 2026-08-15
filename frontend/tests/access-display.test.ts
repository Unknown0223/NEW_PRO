import { describe, expect, it } from "vitest";
import {
  displayAccessDescriptionShort,
  formatPermissionLabel,
  joinPermissionLabelParts,
  normalizeOperationKeyForDisplay
} from "@/lib/access-display";

describe("formatPermissionLabel — Access operatsiya yorliqlari", () => {
  it("katalog description dan to‘liq yo‘l (modul · bo‘lim · amal)", () => {
    expect(
      formatPermissionLabel("Склад / Остатки товаров / Просмотр", "warehouse.ostatki.view")
    ).toBe("Склад · Остатки товаров · Просмотр");
    expect(
      formatPermissionLabel("Склад / Поступление склада / Выгрузка", "warehouse.postuplenie.copy")
    ).toBe("Склад · Поступление склада · Выгрузка");
    expect(
      formatPermissionLabel("Склад / Списание / Аннулирование", "warehouse.spisanie.void")
    ).toBe("Склад · Списание · Аннулирование");
  });

  it("bir xil amal turli bo‘limlarda farqlanadi", () => {
    const a = formatPermissionLabel("Склад / Остатки товаров / Просмотр", "warehouse.ostatki.view");
    const b = formatPermissionLabel("Склад / Поступление склада / Просмотр", "warehouse.postuplenie.view");
    const c = formatPermissionLabel("Склад / Перемещение товара / Просмотр", "warehouse.peremeshchenie.view");
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a).toContain("Остатки");
    expect(b).toContain("Поступление");
    expect(c).toContain("Перемещение");
  });

  it("kalit fallback: module.section.action", () => {
    expect(formatPermissionLabel(null, "warehouse.ostatki.view")).toMatch(/^Склад · .+ · Просмотр$/);
    expect(formatPermissionLabel("", "cash.kassa.history")).toMatch(/^Касса · .+ · История$/);
  });

  it("amal ichidagi slash (Копирование/Выгрузка) buzilmaydi", () => {
    expect(
      formatPermissionLabel(
        "Склад / Остатки товаров / Копирование/Выгрузка",
        "warehouse.ostatki.copy"
      )
    ).toBe("Склад · Остатки товаров · Копирование/Выгрузка");
  });

  it("displayAccessDescriptionShort alias saqlanadi", () => {
    expect(
      displayAccessDescriptionShort("Касса / Приходы / Создание", "cash.prihody.create")
    ).toBe("Касса · Приходы · Создание");
  });

  it("normalizeOperationKeyForDisplay grant prefiksini olib tashlaydi", () => {
    expect(normalizeOperationKeyForDisplay("access.grant.warehouse.ostatki.view")).toBe(
      "warehouse.ostatki.view"
    );
  });

  it("joinPermissionLabelParts", () => {
    expect(joinPermissionLabelParts(["Склад", "Остатки", "Просмотр"])).toBe(
      "Склад · Остатки · Просмотр"
    );
  });
});
