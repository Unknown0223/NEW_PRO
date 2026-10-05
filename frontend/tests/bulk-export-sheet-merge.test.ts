import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { normalizeSheetGroupKey } from "@/lib/bulk-export-sheet-grouping";
import { mergeNakladnoyPrefsForTemplate } from "@/lib/bulk-export-template-settings";
import { mergeXlsxSourcesToBuffer } from "@/lib/merge-xlsx-workbooks";

async function workbook(names: string[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const name of names) {
    const ws = wb.addWorksheet(name);
    ws.getColumn(4).width = 32.71;
    ws.mergeCells("A1:G1");
    const cell = ws.getCell("A1");
    cell.value = `Загрузочний лист ${name}`;
    cell.font = { bold: true, size: 16 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9CEFF" } };
    cell.border = { top: { style: "thin" } };
    ws.getRow(1).height = 20;
  }
  const raw = await wb.xlsx.writeBuffer();
  return Uint8Array.from(raw as unknown as ArrayLike<number>).buffer;
}

describe("bulk export one-file merge", () => {
  it("keeps numbered sheet names, styles and merges", async () => {
    const buf = await mergeXlsxSourcesToBuffer([
      {
        label: "Загруз зав.склада 5.1.8",
        templateId: "ex-5.1.8",
        category: "expeditor",
        separateSheets: true,
        groupBy: "territory",
        data: await workbook(["1.518.BUXORO", "2.518.NAVOIY SHAHAR"])
      },
      {
        label: "Накладные 2.1.7",
        templateId: "inv-2.1.7",
        category: "invoices",
        separateSheets: true,
        groupBy: "territory",
        data: await workbook(["1.217.BUXORO", "2.217.NAVOIY SHAHAR"])
      }
    ]);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(buf);
    expect(out.worksheets.map((s) => s.name)).toEqual([
      "1.518.BUXORO",
      "1.217.BUXORO",
      "2.518.NAVOIY SHAHAR",
      "2.217.NAVOIY SHAHAR"
    ]);
    const ws = out.worksheets[0]!;
    const cell = ws.getCell("A1");
    expect(cell.font?.bold).toBe(true);
    expect(cell.font?.size).toBe(16);
    expect((cell.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFE9CEFF");
    expect(cell.border?.top?.style).toBe("thin");
    expect(ws.getRow(1).height).toBe(20);
    expect(ws.getColumn(4).width).toBeCloseTo(32.71);
    expect((ws as ExcelJS.Worksheet & { model: { merges: string[] } }).model.merges).toContain("A1:G1");
  });

  it("groups numbered sheets by their label", () => {
    expect(normalizeSheetGroupKey("12.518.NAVOIY SHAHAR")).toBe("navoiy shahar");
    expect(normalizeSheetGroupKey("3.110.BUXORO (2)")).toBe("buxoro");
    expect(normalizeSheetGroupKey("Загруз - Иванов")).toBe("иванов");
  });

  it("applies the filter type from template settings without the code type", () => {
    const global = { codeColumn: "barcode", separateSheets: true, groupBy: "agent" } as const;
    expect(mergeNakladnoyPrefsForTemplate(global, { groupBy: "territory" })).toEqual({
      codeColumn: "barcode",
      separateSheets: true,
      groupBy: "territory"
    });
  });
});
