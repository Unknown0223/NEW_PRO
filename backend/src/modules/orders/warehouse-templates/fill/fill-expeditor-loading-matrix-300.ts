/**
 * 3.0 — mahsulotlar qatorlarda, mijozlar ustunlarda (т.т.:…).
 */
import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";
import {
  agentMatchesHeader,
  clearCellValueOnly,
  fillExpeditorMetaBlock,
  findProductRow,
  findRowWith,
  rowText
} from "../expeditor-loading-fill-shared";

export function fillExpeditorLoadingMatrix300(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  _options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = wb.worksheets[0]!;
  fillExpeditorMetaBlock(sheet, ctx, versionLabel, { titleRow: 1, valueCol: 3 });

  const headerRow = findRowWith(
    sheet,
    (r) => rowText(sheet, r, 15).includes("название продукции"),
    1,
    10
  );
  if (headerRow < 0) return;

  let totalCol = -1;
  const clientCols: Array<{ col: number; header: string }> = [];
  for (let c = 1; c <= Math.min(sheet.columnCount, 60); c++) {
    const h = cellStr(sheet.getCell(headerRow, c).value).toLowerCase();
    if (h.includes("итого")) totalCol = c;
    if (h.includes("т.т.:") || h.includes("т.т:")) {
      clientCols.push({ col: c, header: cellStr(sheet.getCell(headerRow, c).value) });
    }
  }

  const dataStart = headerRow + 1;
  for (let r = dataStart; r <= sheet.rowCount; r++) {
    const name = cellStr(sheet.getCell(r, 1).value);
    if (!name) continue;
    for (const { col } of clientCols) clearCellValueOnly(sheet.getCell(r, col));
    if (totalCol > 0) clearCellValueOnly(sheet.getCell(r, totalCol));
  }

  for (const order of ctx.orders) {
    let col: number | null = null;
    for (const cc of clientCols) {
      const clientLine = `${order.clientName} ${order.clientAddress ?? ""}`;
      if (agentMatchesHeader(clientLine, cc.header)) {
        col = cc.col;
        break;
      }
    }
    if (col == null) continue;

    for (const ln of order.lines) {
      if (ln.qty <= 0) continue;
      const pr = findProductRow(sheet, ln.name, dataStart, [1]);
      if (pr < 0) continue;
      const cur = cellStr(sheet.getCell(pr, col).value);
      const curN = cur ? Number(cur.replace(/\s/g, "")) : 0;
      setCell(sheet, pr, col, curN + ln.qty);
    }
  }

  for (let r = dataStart; r <= sheet.rowCount; r++) {
    if (totalCol < 0) break;
    const name = cellStr(sheet.getCell(r, 1).value);
    if (!name) continue;
    let sum = 0;
    for (const { col } of clientCols) {
      const v = Number(cellStr(sheet.getCell(r, col).value).replace(/\s/g, ""));
      if (Number.isFinite(v)) sum += v;
    }
    if (sum > 0) setCell(sheet, r, totalCol, sum);
  }
}
