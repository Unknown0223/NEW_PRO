import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  STAFF_IMPORT_KINDS,
  STAFF_IMPORT_SHEET_NAME,
  parseStaffImportWorkbookForKind,
  rebuildStaffImportWorkbookFile,
  resolveStaffImportKindFromSheetName,
  type StaffImportPreviewSheet
} from "./staff-import-workbook";

function sheetToBuffer(sheets: { name: string; rows: string[][] }[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("staff-import-workbook", () => {
  it("resolves sheet names to kinds", () => {
    expect(resolveStaffImportKindFromSheetName("Агенты")).toBe("agent");
    expect(resolveStaffImportKindFromSheetName("expeditor")).toBe("expeditor");
    expect(resolveStaffImportKindFromSheetName("xxx")).toBeNull();
  });

  it("parses multi-sheet workbook and rebuilds", async () => {
    const file = sheetToBuffer([
      {
        name: STAFF_IMPORT_SHEET_NAME.agent,
        rows: [
          ["Ф.И.О", "Логин", "Код", "Доступ к приложению"],
          ["Иванов Иван", "ivanov", "A1", "Да"]
        ]
      },
      {
        name: STAFF_IMPORT_SHEET_NAME.expeditor,
        rows: [
          ["Ф.И.О", "Логин"],
          ["Петров Пётр", "petrov"]
        ]
      }
    ]);

    const sheets = await parseStaffImportWorkbookForKind(file, "all");
    expect(sheets).toHaveLength(2);
    expect(sheets.map((s) => s.kind).sort()).toEqual(["agent", "expeditor"]);
    expect(sheets.find((s) => s.kind === "agent")?.rows[0]?.[0]).toBe("Иванов Иван");
    expect(sheets.find((s) => s.kind === "agent")?.headers).toContain("Логин");

    const rebuiltFile = rebuildStaffImportWorkbookFile(sheets as StaffImportPreviewSheet[]);
    expect(rebuiltFile.size).toBeGreaterThan(100);
    const againBuf = sheetToBuffer(
      sheets.map((s) => ({
        name: STAFF_IMPORT_SHEET_NAME[s.kind],
        rows: [s.headers, ...s.rows]
      }))
    );
    const again = await parseStaffImportWorkbookForKind(againBuf, "all");
    expect(again).toHaveLength(2);
    expect(again.find((s) => s.kind === "agent")?.rows[0]?.[2]).toBe("A1");
  });

  it("parses legacy Авторизоваться header sheets", async () => {
    const file = sheetToBuffer([
      {
        name: STAFF_IMPORT_SHEET_NAME.agent,
        rows: [
          ["Ф.И.О", "Авторизоваться", "Доступ к приложение"],
          ["Тест Тест", "test1", "Да"]
        ]
      }
    ]);
    const sheets = await parseStaffImportWorkbookForKind(file, "all");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.headers[1]).toBe("Авторизоваться");
    expect(sheets[0]!.rows[0]?.[1]).toBe("test1");
  });

  it("falls back to preferred kind for unnamed single sheet", async () => {
    const file = sheetToBuffer([
      {
        name: "Sheet1",
        rows: [
          ["Ф.И.О", "Логин"],
          ["Тест Тест", "test1"]
        ]
      }
    ]);
    const sheets = await parseStaffImportWorkbookForKind(file, "collector");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.kind).toBe("collector");
  });

  it("covers all canonical sheet labels", () => {
    for (const k of STAFF_IMPORT_KINDS) {
      expect(resolveStaffImportKindFromSheetName(STAFF_IMPORT_SHEET_NAME[k])).toBe(k);
    }
  });

  it("parses empty all-roles-style workbook (headers only) into preview sheets", async () => {
    const file = sheetToBuffer(
      STAFF_IMPORT_KINDS.map((k) => ({
        name: STAFF_IMPORT_SHEET_NAME[k],
        rows: [["Ф.И.О", "Логин", "Код"]]
      }))
    );
    const sheets = await parseStaffImportWorkbookForKind(file, "all");
    expect(sheets).toHaveLength(STAFF_IMPORT_KINDS.length);
    expect(sheets.every((s) => s.rows.length === 0)).toBe(true);
    expect(sheets.every((s) => s.headers.includes("Логин"))).toBe(true);
  });
});
