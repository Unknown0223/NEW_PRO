import type ExcelJS from "exceljs";
import { applyWorksheetMergeRefs, toMergeRef } from "./worksheet-merge-utils";

/** 520 shablon: meta 1–7 va sarlavha 8-qator birlashtirishlari (qatorlar splice dan keyin siljimaydi). */
const META_AND_HEADER_MERGES = [
  "A1:H1",
  "A2:C2",
  "F2:H2",
  "A3:C3",
  "D3:E3",
  "F3:H3",
  "A4:C4",
  "D4:E4",
  "F4:H4",
  "A5:C5",
  "D5:H5",
  "A6:C6",
  "D6:H6",
  "A7:C7",
  "D7:E7",
  "F7:H7",
  "B8:C8"
] as const;

/**
 * spliceRows dan keyin ExcelJS merge diapazonlari noto‘g‘ri qoladi — Excel sheet1.xml ni «repair» qiladi.
 * Meta (1–8), ma'lumot B:C, Итого A:D + G:H, footer A:C + G:H qayta yoziladi.
 */
export function rebuildExpeditor520Merges(
  ws: ExcelJS.Worksheet,
  dataStart: number,
  totalRow: number,
  isFooterRow: (r: number) => boolean
): void {
  const rebuilt: string[] = [...META_AND_HEADER_MERGES];

  for (let r = dataStart; r < totalRow; r++) {
    rebuilt.push(toMergeRef(r, 2, r, 3));
  }

  rebuilt.push(toMergeRef(totalRow, 1, totalRow, 4));
  rebuilt.push(toMergeRef(totalRow, 7, totalRow, 8));

  for (let r = totalRow + 1; r <= ws.rowCount; r++) {
    if (isFooterRow(r)) {
      rebuilt.push(toMergeRef(r, 1, r, 3));
      rebuilt.push(toMergeRef(r, 7, r, 8));
      continue;
    }
    const row = ws.getRow(r);
    const hasCells = row.actualCellCount > 0;
    if (!hasCells) rebuilt.push(toMergeRef(r, 1, r, 8));
  }

  applyWorksheetMergeRefs(ws, rebuilt);
}
