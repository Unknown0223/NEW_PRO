import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell, fmtRuDateShort, cellStr } from "../warehouse-template-fill.helpers";

// ── Raqam formatlari ────────────────────────────────────────────
/** 3 xonali ajratuvchi, butun son */
const NUM_FMT_INT   = '# ##0';
/** 3 xonali ajratuvchi, narx/summa */
const NUM_FMT_MONEY = '# ##0';

function stripExpeditorLine(line: string): string {
  return line
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(\d{2}\.\d{2}\.\d{4}\).*$/, "")
    .trim();
}

// ── Yordamchi: katak formati ─────────────────────────────────────
function applyNumCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: number,
  fmt: string,
  align: "right" | "center" | "left" = "right"
) {
  const c = ws.getCell(row, col);
  c.value = value;
  c.numFmt = fmt;
  c.alignment = { horizontal: align, vertical: "middle" };
}

export function fillPerExpeditor701(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  const blocks = ctx.expeditorBlocks.filter((b) => b.lines.some((l) => l.qty > 0));

  let searchFrom = 1;
  for (const block of blocks) {
    let headerRow = -1;
    for (let r = searchFrom; r <= ws.rowCount; r++) {
      const c2 = cellStr(ws.getCell(r, 2).value);
      if (c2 === "ЭКСПЕДИТОР" || c2 === "ЭКСПЕДИТОР ") {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) break;

    // Ekspeditor nomi — chapga tekis
    const expCell = ws.getCell(headerRow, 6);
    expCell.value = stripExpeditorLine(block.expeditorLine);
    expCell.alignment = { horizontal: "left", vertical: "middle" };

    // TUZATISH 1: Sana — DD.MM.YYYY formatda string (fmtRuDateShort allaqachon shunday)
    const dateCell = ws.getCell(headerRow - 1, 7);
    dateCell.value = fmtRuDateShort(ctx.now);
    dateCell.alignment = { horizontal: "center", vertical: "middle" };

    let row = headerRow + 1;
    let idx = 1;
    let totalQty = 0;
    let totalSum = 0;

    for (const ln of block.lines) {
      if (ln.qty <= 0) continue;
      if (cellStr(ws.getCell(row, 2).value) === "ИТОГО") break;

      // Tartib raqam — markazlashtirilgan
      const numCell = ws.getCell(row, 1);
      numCell.value = idx++;
      numCell.alignment = { horizontal: "center", vertical: "middle" };

      // Mahsulot nomi — chapga tekis
      const nameCell = ws.getCell(row, 2);
      nameCell.value = ln.name;
      nameCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      // Birlik — markazlashtirilgan
      const unitCell = ws.getCell(row, 3);
      unitCell.value = "шт.";
      unitCell.alignment = { horizontal: "center", vertical: "middle" };

      // TUZATISH 2: qty — son formatda, 3 xonali
      applyNumCell(ws, row, 4, ln.qty, NUM_FMT_INT, "right");

      // TUZATISH 3: price — son formatda, 3 xonali
      if (ln.price > 0) {
        applyNumCell(ws, row, 5, ln.price, NUM_FMT_MONEY, "right");
      }

      // TUZATISH 4: sum — son formatda, 3 xonali
      if (ln.sum > 0) {
        applyNumCell(ws, row, 6, ln.sum, NUM_FMT_MONEY, "right");
      }

      totalQty += ln.qty;
      totalSum += ln.sum;
      row++;
    }

    const totalRow = row;
    if (cellStr(ws.getCell(totalRow, 2).value) === "ИТОГО") {
      // TUZATISH 5: Jami — son formatda, qalin, o'ng
      applyNumCell(ws, totalRow, 4, totalQty, NUM_FMT_INT, "right");
      ws.getCell(totalRow, 4).font = { bold: true };

      if (totalSum > 0) {
        applyNumCell(ws, totalRow, 6, totalSum, NUM_FMT_MONEY, "right");
        ws.getCell(totalRow, 6).font = { bold: true };
      }
    }
    searchFrom = totalRow + 2;
  }
}
