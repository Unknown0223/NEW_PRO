/**
 * 2.0 — mahsulotlar USTUNLARDA, mijozlar QATORLARDA.
 */
import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";
import {
  clearCellValueOnly,
  fillExpeditorMetaBlock,
  findRowWith,
  rowText
} from "../expeditor-loading-fill-shared";

export function fillExpeditorLoadingMatrixClients(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  _options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = wb.worksheets[0]!;
  fillExpeditorMetaBlock(sheet, ctx, versionLabel);

  const headerRow = findRowWith(
    sheet,
    (r) => rowText(sheet, r, 8).includes("имя клиента") || rowText(sheet, r, 8).includes("адресс"),
    1,
    15
  );
  if (headerRow < 0) return;

  const productCols: Array<{ col: number; name: string }> = [];
  for (let c = 4; c <= Math.min(sheet.columnCount, 80); c++) {
    const name = cellStr(sheet.getCell(headerRow, c).value);
    if (!name || name.toLowerCase() === "цена" || name.toLowerCase() === "продукт") continue;
    if (name.toLowerCase() === "сум") continue;
    productCols.push({ col: c, name });
  }

  const dataStart = headerRow + 1;
  for (let r = dataStart; r <= sheet.rowCount; r++) {
    for (const { col } of productCols) clearCellValueOnly(sheet.getCell(r, col));
  }

  for (const order of ctx.orders) {
    const clientKey = (order.clientName || "").trim().toLowerCase();
    if (!clientKey) continue;
    let clientRow = -1;
    for (let r = dataStart; r <= sheet.rowCount; r++) {
      const name = cellStr(sheet.getCell(r, 2).value).toLowerCase();
      if (name && (name.includes(clientKey.slice(0, 12)) || clientKey.includes(name.slice(0, 12)))) {
        clientRow = r;
        break;
      }
    }
    if (clientRow < 0) continue;

    for (const ln of order.lines) {
      if (ln.qty <= 0) continue;
      const pc = productCols.find((p) => p.name.toLowerCase() === ln.name.trim().toLowerCase());
      if (!pc) continue;
      const cur = cellStr(sheet.getCell(clientRow, pc.col).value);
      const curN = cur ? Number(cur.replace(/\s/g, "")) : 0;
      setCell(sheet, clientRow, pc.col, curN + ln.qty);
    }
  }
}
