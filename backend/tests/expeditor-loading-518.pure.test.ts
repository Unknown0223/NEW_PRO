import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { fmtDate } from "../src/modules/orders/order-nakladnoy-xlsx.format";
import {
  DEFAULT_NAKLADNOY_BUILD_OPTIONS,
  type NakladnoyBuildOptions,
  type NakladnoyLine,
  type NakladnoyOrderPayload
} from "../src/modules/orders/order-nakladnoy-xlsx.types";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
import { buildWarehouseLoadXlsx } from "../src/modules/orders/warehouse-templates/build-warehouse-load-xlsx";
import { buildNakladnoyXlsx } from "../src/modules/orders/order-nakladnoy-xlsx";
import { cellStr } from "../src/modules/orders/warehouse-templates/warehouse-template-fill.helpers";

function line(i: number, group: string, bonus = 0): NakladnoyLine {
  return {
    productId: i,
    sku: `SKU-${i}`,
    barcode: `460${String(i).padStart(8, "0")}`,
    name: `Товар ${String(i).padStart(2, "0")}`,
    qty: i,
    bonusQty: bonus,
    price: 1000 + i,
    sum: (1000 + i) * i,
    groupTitle: group,
    qtyPerBlock: 6
  };
}

function order(
  lines: NakladnoyLine[],
  over: Partial<NakladnoyOrderPayload> = {}
): NakladnoyOrderPayload {
  return {
    id: 720,
    number: "722",
    createdAt: new Date("2026-10-03T06:00:00Z"),
    dateTo: new Date("2026-10-05T08:00:00Z"),
    shipDate: new Date("2026-10-05T08:00:00Z"),
    tenantName: "Aksit",
    tenantPhone: null,
    clientName: "DAVLETOV",
    clientPhone: null,
    clientBalanceNum: new Prisma.Decimal(0),
    clientAddress: "Ташкент",
    clientLandmark: null,
    orderComment: null,
    discountSum: 0,
    currencyLabel: "So'm (UZS)",
    agentLine: "A-01 - [Agent] 01/02/26",
    invoiceAgentLine: "A-01",
    agentName: "Agent",
    agentPhone: "+998901112233",
    expeditorLine: "[NAVOI] ABDURAHMONOV HIKMATILLO ( 28.04.2026 )",
    expeditorName: "ABDURAHMONOV HIKMATILLO",
    expeditorPhone: null,
    territory: "NAVOIY SHAHAR",
    invoiceTerritory: "NAVOIY SHAHAR",
    warehouseName: "Склад",
    agentId: 1,
    expeditorUserId: 1,
    isConsignment: false,
    paymentMethodRef: null,
    orderType: "order",
    lines,
    paidLines: lines,
    bonusLines: lines.filter((l) => l.bonusQty > 0),
    ...over
  };
}

const second = (lines: NakladnoyLine[]) =>
  order(lines, {
    id: 721,
    agentLine: "B-02 - [Boshqa] 01/02/26",
    agentId: 2,
    expeditorLine: "[BUX] BROMIRNOV HAMDAM ( 01.05.2026 )",
    expeditorName: "BROMIRNOV HAMDAM",
    expeditorUserId: 2,
    territory: "BUXORO",
    invoiceTerritory: "BUXORO"
  });

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  return wb;
}

function opts(over: Partial<NakladnoyBuildOptions> = {}): NakladnoyBuildOptions {
  return { ...DEFAULT_NAKLADNOY_BUILD_OPTIONS, ...over };
}

function mergesOf(sheet: ExcelJS.Worksheet): string[] {
  return (sheet as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges ?? [];
}

function findRow(sheet: ExcelJS.Worksheet, col: number, text: string): number {
  for (let r = 1; r <= sheet.rowCount; r++) {
    if (cellStr(sheet.getCell(r, col).value) === text) return r;
  }
  return -1;
}

describe("expeditor loading 5.1.8 (sample layout)", () => {
  it("builds the header, groups, bonus block and signatures like the sample", async () => {
    const lines = [line(1, "GIGA"), line(2, "GIGA", 3), line(3, "LIPUCHKA")];
    const wb = await load(
      await buildExpeditorLoadingXlsx(
        "ex-5.1.8",
        [order(lines)],
        opts({ codeColumn: "barcode", groupBy: "expeditor" })
      )
    );
    expect(wb.worksheets).toHaveLength(1);
    const sheet = wb.worksheets[0]!;
    expect(sheet.name).toBe("1.518.NAVOI ABDURAHMONOV HIKMAT");

    expect(cellStr(sheet.getCell(1, 1).value)).toMatch(/^Загрузочний лист \(Время печата: /);
    expect(cellStr(sheet.getCell(2, 1).value)).toBe("Дата заявки");
    expect(cellStr(sheet.getCell(2, 4).value)).toBe(fmtDate(new Date("2026-10-03T06:00:00Z")));
    expect(cellStr(sheet.getCell(3, 1).value)).toBe("Дата отгрузки");
    expect(cellStr(sheet.getCell(3, 4).value)).toBe(fmtDate(new Date("2026-10-05T08:00:00Z")));
    expect(cellStr(sheet.getCell(4, 4).value)).toContain("A-01");
    expect(cellStr(sheet.getCell(4, 6).value)).toBe("+998901112233");
    expect(cellStr(sheet.getCell(5, 4).value)).toBe("NAVOIY SHAHAR");
    expect(cellStr(sheet.getCell(6, 4).value)).toBe("[NAVOI] ABDURAHMONOV HIKMATILLO ( 28.04.2026 )");
    expect(cellStr(sheet.getCell(7, 4).value)).toBe("So'm (UZS)");
    expect(["№", "Код", "Продукт", "Кол-во", "Цена", "Сумма"]).toEqual(
      [1, 2, 4, 5, 6, 7].map((c) => cellStr(sheet.getCell(8, c).value))
    );

    const merges = mergesOf(sheet);
    for (const m of ["A1:G1", "A2:C2", "D3:E3", "F4:G4", "D5:G5", "D6:G6", "B8:C8"]) {
      expect(merges).toContain(m);
    }

    expect(cellStr(sheet.getCell(9, 4).value)).toBe("GIGA");
    expect(cellStr(sheet.getCell(10, 1).value)).toBe("1");
    expect(cellStr(sheet.getCell(10, 2).value)).toBe("46000000001");
    expect(cellStr(sheet.getCell(10, 4).value)).toBe("Товар 01");
    expect(cellStr(sheet.getCell(12, 4).value)).toBe("LIPUCHKA");
    expect(cellStr(sheet.getCell(13, 1).value)).toBe("3");

    const total = findRow(sheet, 1, "Общая сумма");
    expect(total).toBe(14);
    expect(merges).toContain(`A${total}:D${total}`);
    expect(merges).toContain(`F${total}:G${total}`);
    expect(sheet.getCell(total, 5).value).toBe(6);

    const bonus = findRow(sheet, 4, "Бонус");
    expect(bonus).toBe(total + 2);
    expect(sheet.getRow(total + 1).height).toBe(10);
    expect(sheet.getCell(bonus, 5).value).toBe(3);
    expect(cellStr(sheet.getCell(bonus + 1, 1).value)).toBe("1");
    expect(cellStr(sheet.getCell(bonus + 1, 4).value)).toBe("Товар 02");

    const signRow = findRow(sheet, 1, "___________________________");
    expect(signRow).toBe(bonus + 3);
    expect(cellStr(sheet.getCell(signRow + 1, 1).value)).toBe("Складчик");
    expect(cellStr(sheet.getCell(signRow + 1, 6).value)).toBe("Доставщик");
    expect(sheet.rowCount).toBe(signRow + 1);
  });

  it("puts the signatures right after the total when there is no bonus", async () => {
    const wb = await load(await buildExpeditorLoadingXlsx("ex-5.1.8", [order([line(1, "GIGA")])], opts()));
    const sheet = wb.worksheets[0]!;
    const total = findRow(sheet, 1, "Общая сумма");
    expect(findRow(sheet, 4, "Бонус")).toBe(-1);
    expect(cellStr(sheet.getCell(total + 2, 1).value)).toBe("___________________________");
    expect(cellStr(sheet.getCell(total + 1, 2).value)).toBe("");
  });

  it.each([
    ["expeditor", ["1.518.BUX BROMIRNOV HAMDAM", "2.518.NAVOI ABDURAHMONOV HIKMAT"]],
    ["territory", ["1.518.BUXORO", "2.518.NAVOIY SHAHAR"]],
    ["agent", ["1.518.A-01 - Agent", "2.518.B-02 - Boshqa"]]
  ] as const)("splits by %s into named sheets", async (groupBy, names) => {
    const orders = [order([line(1, "GIGA")]), second([line(2, "GIGA")])];
    const wb = await load(
      await buildExpeditorLoadingXlsx("ex-5.1.8", orders, opts({ separateSheets: true, groupBy }))
    );
    expect(wb.worksheets.map((s) => s.name)).toEqual(names);
  });
});

describe("separate sheets for other nakladnoy templates", () => {
  const orders = [order([line(1, "GIGA")]), second([line(2, "GIGA")])];
  const split = opts({ separateSheets: true, groupBy: "territory" });

  it("splits template-based expeditor loading and keeps styles", async () => {
    const wb = await load(await buildExpeditorLoadingXlsx("ex-5.1.6", orders, split));
    expect(wb.worksheets.map((s) => s.name)).toEqual(["1.516.BUXORO", "2.516.NAVOIY SHAHAR"]);
    const s = wb.worksheets[1]!;
    expect(cellStr(s.getCell(4, 4).value)).toBe("NAVOIY SHAHAR");
    expect(s.getCell(1, 1).font?.bold).toBe(true);
    expect(mergesOf(s).length).toBeGreaterThan(0);
  });

  it("splits 5.2.0 into one sheet per group", async () => {
    const wb = await load(await buildExpeditorLoadingXlsx("ex-5.2.0", orders, split));
    expect(wb.worksheets.map((s) => s.name)).toEqual(["1.520.BUXORO", "2.520.NAVOIY SHAHAR"]);
  });

  it("splits warehouse templates by the chosen filter", async () => {
    const wb = await load(await buildWarehouseLoadXlsx("wh-1.1", orders, split));
    expect(wb.worksheets[0]!.name.startsWith("1.110.BUXORO")).toBe(true);
    expect(wb.worksheets.some((s) => s.name.startsWith("2.110.NAVOIY SHAHAR"))).toBe(true);
  });

  it("names invoice sheets by the group", async () => {
    const wb = await load(await buildNakladnoyXlsx("nakladnoy_expeditor", orders, split));
    expect(wb.worksheets.map((s) => s.name)).toEqual(["1.217.BUXORO", "2.217.NAVOIY SHAHAR"]);
  });

  it("keeps a single sheet when separate sheets is off", async () => {
    const wb = await load(await buildExpeditorLoadingXlsx("ex-5.1.6", orders, opts()));
    expect(wb.worksheets).toHaveLength(1);
  });
});

describe("expeditor loading 5.1.6 / 5.1.7 headers", () => {
  it("updates inline dates", async () => {
    const lines = [line(1, "GIGA")];
    for (const layout of ["ex-5.1.6", "ex-5.1.7"] as const) {
      const wb = await load(await buildExpeditorLoadingXlsx(layout, [order(lines)], opts()));
      const sheet = wb.worksheets[0]!;
      expect(cellStr(sheet.getCell(2, 1).value)).toBe(`Дата заявки: ${fmtDate(order(lines).createdAt)}`);
      expect(cellStr(sheet.getCell(2, 4).value)).toContain("Дата отгрузки:");
      expect(cellStr(sheet.getCell(5, 4).value)).toBe("+998901112233");
    }
  });
});
