import { describe, expect, it } from "vitest";
import {
  consignment217AddressLine,
  consignment217AgentValue,
  consignment217BalanceLine,
  consignment217BonusTitle,
  consignment217ClientLine,
  consignment217CommentLine,
  consignment217DateLine,
  consignment217DiscountLine,
  consignment217ExpeditorLine,
  consignment217LandmarkLine,
  consignment217MoneyWithPay,
  consignment217OrderTitle,
  consignment217PaymentLabel,
  consignment217PersonBlock,
  consignment217SheetName,
  consignment217TerritoryLine,
  formatNakladnoyClientPhone,
  isLoading520ShelfReturnType,
  LOADING_520_SHELF_RETURN_GROUP,
  loading520AgentLabel,
  loading520IsShelfReturnOnly,
  loading520SheetName,
  loading520Title,
  sortLoading520GroupKeys,
  wrapNakladnoyFieldText
} from "../src/modules/orders/order-nakladnoy-xlsx.consignment-217";

describe("nakladnoy 2.1.7 / 5.2.0 shablon matnlari", () => {
  it("formats client phone like the Excel sample", () => {
    expect(formatNakladnoyClientPhone("998901456763")).toBe("+998 (90) 145-67-63");
    expect(consignment217ClientLine("NARGIZAXON YAYMA", "998901456763")).toBe(
      "Клиент: NARGIZAXON YAYMA (тел: +998 (90) 145-67-63)"
    );
  });

  it("writes full-line headers and consignment titles", () => {
    expect(consignment217BalanceLine(-7333490)).toMatch(/Баланс клиента: -7\s333\s490,00 UZS/);
    expect(consignment217AddressLine("ASAKA, UZ")).toBe("Адрес: ASAKA, UZ");
    expect(consignment217AddressLine("")).toBeNull();
    expect(consignment217AddressLine("—")).toBeNull();
    expect(consignment217LandmarkLine("ro'yxat yonida")).toBe("Ориентир: ro'yxat yonida");
    expect(consignment217LandmarkLine("  ")).toBeNull();
    expect(consignment217CommentLine("tez yetkazilsin")).toBe("Комментарий: tez yetkazilsin");
    expect(consignment217CommentLine(null)).toBeNull();
    expect(consignment217DiscountLine(150000)).toMatch(/Скидка: .* UZS/);
    expect(consignment217DiscountLine(0)).toBeNull();
    expect(consignment217DiscountLine(null)).toBeNull();
    expect(consignment217ExpeditorLine("AAND ASQAROV AZIZBEK")).toBe(
      "Экспедитор: AAND ASQAROV AZIZBEK"
    );
    expect(consignment217ExpeditorLine("")).toBeNull();
    expect(consignment217PersonBlock("Агент", "Murodqulova Nargiza", "99899375125")).toBe(
      "Агент: Murodqulova Nargiza\n99899375125"
    );
    expect(consignment217PersonBlock("Агент", "Murodqulova Nargiza", "998993751250")).toBe(
      "Агент: Murodqulova Nargiza\n+998 (99) 375-12-50"
    );
    expect(consignment217PersonBlock("Экспедитор", "ASQAROV AZIZBEK", null)).toBe(
      "Экспедитор: ASQAROV AZIZBEK"
    );
    expect(consignment217PersonBlock("Агент", null, "99890")).toBeNull();
    expect(consignment217TerritoryLine("SOUTH-WEST / Samarqand / BULUNGUR")).toBe(
      "Территория: SOUTH-WEST / Samarqand / BULUNGUR"
    );
    expect(consignment217TerritoryLine("—")).toBeNull();
    expect(consignment217DateLine(new Date(2026, 8, 5))).toBe("Дата накладной: 05.09.2026");
    expect(consignment217OrderTitle("1657030", true)).toBe("Заказ (№1657030) - НА КОНСИГНАЦИЮ");
    expect(consignment217BonusTitle("1657030", true)).toBe("Бонус(№1657030) - НА КОНСИГНАЦИЮ");
    expect(consignment217OrderTitle("1", false)).toBe("Заказ (№1)");
  });

  it("wraps long orient/comment without unbounded growth", () => {
    const long = "A".repeat(200) + " " + "B".repeat(50);
    const wrapped = wrapNakladnoyFieldText(long, 40, 3);
    expect(wrapped.split("\n").length).toBeLessThanOrEqual(3);
    expect(wrapped.length).toBeLessThan(long.length + 10);
    expect(consignment217LandmarkLine(long)?.startsWith("Ориентир:")).toBe(true);
  });

  it("keeps общий итог payment as goods-only NAQD PUL", () => {
    expect(consignment217PaymentLabel("cash")).toBe("NAQD PUL");
    expect(consignment217MoneyWithPay(960000, "NAQD PUL")).toMatch(/960\s?000 NAQD PUL/);
  });

  it("builds invoice agent line and sheet names", () => {
    const agent = consignment217AgentValue({
      code: "LLKAN (I) AGENT - 02",
      name: "ALIJONOV ABDUMUXTOR",
      territory: "ASAKA",
      createdAt: new Date(2026, 5, 7),
      phone: "998941405111"
    });
    expect(agent).toBe("LLKAN (I) AGENT - 02 [ALIJONOV ABDUMUXTOR] ASAKA 07.06.2026 (998941405111)");
    expect(consignment217SheetName("AAND ASQAROV AZIZBEK")).toBe("1.217.AAND ASQAROV AZIZBEK");
    expect(loading520SheetName("Quqon Isaqov Xasan")).toBe("1.520.Quqon Isaqov Xasan");
    expect(loading520AgentLabel("MONNOQQ05", "ABDURAZOQOV SHUKURULLOX", new Date(2026, 11, 1))).toBe(
      "MONNOQQ05 - [ABDURAZOQOV SHUKURULLOX] 01/12/26"
    );
    expect(loading520Title(new Date(2026, 8, 5, 11, 57, 39))).toBe(
      "Загрузочний лист (Время печата: 05.09.2026 11:57:39)"
    );
  });

  it("puts Возврат с полки last among 5.2.0 groups", () => {
    expect(isLoading520ShelfReturnType("return")).toBe(true);
    expect(isLoading520ShelfReturnType("return_by_order")).toBe(true);
    expect(isLoading520ShelfReturnType("order")).toBe(false);
    expect(
      sortLoading520GroupKeys(["Возврат с полки", "Prokladki", "Monno trusik mini"])
    ).toEqual(["Monno trusik mini", "Prokladki", LOADING_520_SHELF_RETURN_GROUP]);
    expect(loading520IsShelfReturnOnly(["Возврат с полки"])).toBe(true);
    expect(loading520IsShelfReturnOnly(["Monno trusik mini", "Возврат с полки"])).toBe(false);
  });
});
