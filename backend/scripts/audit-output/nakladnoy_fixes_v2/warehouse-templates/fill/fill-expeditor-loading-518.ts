import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine } from "../../order-nakladnoy-xlsx.types";
import {
  fmtDate,
  fmtDateTime,
  lineCodeDisplay,
  uniqJoin
} from "../../order-nakladnoy-xlsx.format";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";

// ── Raqam formatlari ────────────────────────────────────────────
/** 3 xonali ajratuvchi, butun son: 1 234 567 */
const NUM_FMT_INT   = '# ##0';
/** 3 xonali ajratuvchi, narx/summa: 1 234 567 */
const NUM_FMT_MONEY = '# ##0';
/** Sana: DD.MM.YYYY */
const NUM_FMT_DATE  = 'DD.MM.YYYY';

const GROUP_BLUE = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF00CCFF" }
};

function findRowWith(sheet: ExcelJS.Worksheet, pred: (r: number) => boolean, from = 1, to?: number): number {
  const end = to ?? sheet.rowCount;
  for (let r = from; r <= end; r++) {
    if (pred(r)) return r;
  }
  return -1;
}

function rowText(sheet: ExcelJS.Worksheet, r: number): string {
  const parts: string[] = [];
  for (let c = 1; c <= 8; c++) {
    const t = cellStr(sheet.getCell(r, c).value);
    if (t) parts.push(t);
  }
  return parts.join(" ").toLowerCase();
}

function metaAgentPhones(ctx: WarehouseAggregateContext): string {
  const phones = ctx.orders
    .map((o) => {
      const m = /(\+?\d[\d\s\-()]{8,})/.exec(o.agentLine);
      return m?.[1]?.trim() ?? "";
    })
    .filter(Boolean);
  return uniqJoin([...new Set(phones)]);
}

function clearRow(sheet: ExcelJS.Worksheet, r: number) {
  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(r, c);
    if (!cell.formula) cell.value = null;
  }
}

function clearRowWithFill(sheet: ExcelJS.Worksheet, r: number) {
  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(r, c);
    if (!cell.formula) cell.value = null;
    cell.fill = { type: "pattern", pattern: "none" };
  }
}

function dashToNull(v: string): string | null {
  const t = v.trim();
  return !t || t === "—" ? null : t;
}

function hideRows(sheet: ExcelJS.Worksheet, fromRow: number, toRow: number) {
  if (toRow < fromRow) return;
  for (let r = fromRow; r <= toRow; r++) {
    if (r < 1 || r > sheet.rowCount) continue;
    sheet.getRow(r).hidden = true;
  }
}

// ── Yordamchi: katak markazlashtirish ───────────────────────────
function alignCenter(cell: ExcelJS.Cell) {
  cell.alignment = { horizontal: "center", vertical: "middle" };
}
function alignRight(cell: ExcelJS.Cell) {
  cell.alignment = { horizontal: "right", vertical: "middle" };
}
function alignLeft(cell: ExcelJS.Cell) {
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

// ── Guruh satri ─────────────────────────────────────────────────
function writeGroupRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  groupName: string,
  qty: number,
  sum: number
) {
  try { sheet.mergeCells(row, 3, row, 4); } catch { /* allaqachon merge */ }

  const g = sheet.getCell(row, 3);
  g.value = groupName;
  g.font = { bold: true };
  g.fill = GROUP_BLUE;
  alignLeft(g);

  // TUZATISH 1: qty — butun son, NUM_FMT_INT
  const q = sheet.getCell(row, 5);
  q.value = qty > 0 ? qty : null;
  q.numFmt = NUM_FMT_INT;
  q.fill = GROUP_BLUE;
  q.font = { bold: true };
  alignRight(q);

  // TUZATISH 2: sum — son formatda, NUM_FMT_MONEY
  const s = sheet.getCell(row, 7);
  s.value = sum > 0 ? sum : null;
  s.numFmt = NUM_FMT_MONEY;
  s.fill = GROUP_BLUE;
  s.font = { bold: true };
  alignRight(s);
}

// ── Mahsulot satri ───────────────────────────────────────────────
function writeProductRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  idx: number,
  ln: NakladnoyLine,
  options: NakladnoyBuildOptions
) {
  try { sheet.mergeCells(row, 3, row, 4); } catch { /* */ }

  const numCell = sheet.getCell(row, 1);
  numCell.value = idx;
  alignCenter(numCell);

  const codeCell = sheet.getCell(row, 2);
  codeCell.value = lineCodeDisplay(ln, options.codeColumn);
  alignCenter(codeCell);

  const nameCell = sheet.getCell(row, 3);
  nameCell.value = ln.name;
  alignLeft(nameCell);

  // TUZATISH 3: qty — raqam sifatida, 3 xonali format
  if (ln.qty > 0) {
    const qCell = sheet.getCell(row, 5);
    qCell.value = ln.qty;
    qCell.numFmt = NUM_FMT_INT;
    alignRight(qCell);
  }

  // TUZATISH 4: price — raqam sifatida, 3 xonali format
  if (ln.price > 0) {
    const pCell = sheet.getCell(row, 6);
    pCell.value = ln.price;
    pCell.numFmt = NUM_FMT_MONEY;
    alignRight(pCell);
  }

  // TUZATISH 5: sum — raqam sifatida, 3 xonali format
  if (ln.sum > 0) {
    const sCell = sheet.getCell(row, 7);
    sCell.value = ln.sum;
    sCell.numFmt = NUM_FMT_MONEY;
    alignRight(sCell);
  }
}

// ── Bonus mahsulot satri ─────────────────────────────────────────
function writeBonusProductRow(sheet: ExcelJS.Worksheet, row: number, idx: number, ln: NakladnoyLine) {
  try { sheet.mergeCells(row, 3, row, 4); } catch { /* */ }

  const numCell = sheet.getCell(row, 1);
  numCell.value = idx;
  alignCenter(numCell);

  const nameCell = sheet.getCell(row, 3);
  nameCell.value = ln.name;
  alignLeft(nameCell);

  if (ln.bonusQty > 0) {
    const qCell = sheet.getCell(row, 5);
    qCell.value = ln.bonusQty;
    qCell.numFmt = NUM_FMT_INT;
    alignRight(qCell);
  }

  if (ln.price > 0) {
    const pCell = sheet.getCell(row, 6);
    pCell.value = ln.price;
    pCell.numFmt = NUM_FMT_MONEY;
    alignRight(pCell);
  }
}

// ── Sana katakchasi ──────────────────────────────────────────────
function setDateCell(sheet: ExcelJS.Worksheet, row: number, col: number, value: string | null) {
  const c = sheet.getCell(row, col);
  if (!value) { c.value = null; return; }
  // TUZATISH 6: Sana — string holida DD.MM.YYYY (format.ts fmtDate allaqachon shunday)
  c.value = value;
  alignLeft(c);
}

// ── Asosiy eksport funksiyasi ────────────────────────────────────
export function fillExpeditorLoading518(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = wb.worksheets[0]!;
  const merged = ctx.merged;
  const dateShip = merged.dateTo ? fmtDate(merged.dateTo) : null;

  // TUZATISH 7: Sarlavha — markazlashtirilgan
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `Загрузочный лист ${versionLabel} (Время печати: ${fmtDateTime(ctx.now)})`;
  titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  setDateCell(sheet, 2, 1, `Дата заявки: ${fmtDate(merged.createdAt)}`);
  setDateCell(sheet, 2, 4, dateShip ? `Дата отгрузки: ${dateShip}` : null);

  const agents = ctx.agentLabels.join(", ") || merged.agentLine;
  setCell(sheet, 3, 4, dashToNull(agents));

  const territory = ctx.territoryLabels.join(", ") || merged.territory || "—";
  setCell(sheet, 4, 4, dashToNull(territory));

  const agentPhones = metaAgentPhones(ctx);
  setCell(sheet, 5, 4, dashToNull(agentPhones));

  const exp = ctx.expeditorLabels.join(", ") || merged.expeditorLine;
  setCell(sheet, 6, 4, dashToNull(exp));

  const headerRow = findRowWith(
    sheet,
    (r) => rowText(sheet, r).includes("количество") && rowText(sheet, r).includes("продукт"),
    1, 30
  );
  const bonusRow  = findRowWith(sheet, (r) => rowText(sheet, r).includes("бонусы"), headerRow > 0 ? headerRow : 8, 80);
  const totalRow  = findRowWith(sheet, (r) => rowText(sheet, r).includes("общая сумма"), headerRow > 0 ? headerRow : 8, 90);
  const returnRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("возврат"), totalRow > 0 ? totalRow : 8, 100);

  const dataStart = headerRow > 0 ? headerRow + 1 : 9;
  const dataEnd   = bonusRow > 0 ? bonusRow - 1 : totalRow > 0 ? totalRow - 1 : Math.min(sheet.rowCount, dataStart + 40);

  for (let r = dataStart; r <= dataEnd; r++) clearRow(sheet, r);

  const linesByGroup = ctx.linesByGroup;
  const groupKeys    = [...linesByGroup.keys()].sort((a, b) => a.localeCompare(b, "ru"));

  let row = dataStart;
  let idx = 1;
  let grandQty = 0;
  let grandSum = 0;

  for (const gk of groupKeys) {
    const groupLines = linesByGroup.get(gk)!.filter((ln) => ln.qty > 0);
    if (groupLines.length === 0) continue;

    let gQty = 0;
    let gSum = 0;
    for (const ln of groupLines) { gQty += ln.qty; gSum += ln.sum; }

    writeGroupRow(sheet, row, gk, gQty, gSum);
    row++;

    for (const ln of groupLines) {
      writeProductRow(sheet, row, idx++, ln, options);
      grandQty += ln.qty;
      grandSum += ln.sum;
      row++;
    }
  }
  const lastProductRow = row - 1;

  // TUZATISH 8: Jami — son formatda, markazlashtirilmagan (o'ng)
  if (totalRow > 0) {
    const tqCell = sheet.getCell(totalRow, 5);
    tqCell.value = grandQty;
    tqCell.numFmt = NUM_FMT_INT;
    alignRight(tqCell);

    if (grandSum > 0) {
      const tsCell = sheet.getCell(totalRow, 6);
      tsCell.value = grandSum;
      tsCell.numFmt = NUM_FMT_MONEY;
      alignRight(tsCell);
    }
  }

  const bonusLines = ctx.lines.filter((ln) => ln.bonusQty > 0);
  if (bonusRow > 0) {
    if (bonusLines.length === 0) {
      const bonusEnd = totalRow > bonusRow ? totalRow - 1 : returnRow > bonusRow ? returnRow - 1 : bonusRow + 10;
      clearRowWithFill(sheet, bonusRow);
      for (let br = bonusRow + 1; br <= bonusEnd; br++) clearRow(sheet, br);
      hideRows(sheet, lastProductRow + 1, bonusRow - 1);
      hideRows(sheet, bonusRow, bonusEnd);
    } else {
      hideRows(sheet, lastProductRow + 1, bonusRow - 1);

      const bonusQtyTotal = bonusLines.reduce((a, ln) => a + ln.bonusQty, 0);
      if (bonusQtyTotal > 0) {
        const bqCell = sheet.getCell(bonusRow, 5);
        bqCell.value = bonusQtyTotal;
        bqCell.numFmt = NUM_FMT_INT;
        alignRight(bqCell);
      }

      let br = bonusRow + 1;
      let bi = 1;
      const bonusEnd = totalRow > bonusRow ? totalRow - 1 : returnRow > bonusRow ? returnRow - 1 : br + 10;
      for (; br <= bonusEnd; br++) clearRow(sheet, br);
      br = bonusRow + 1;
      for (const ln of bonusLines) {
        if (br >= bonusEnd) break;
        writeBonusProductRow(sheet, br, bi++, ln);
        br++;
      }

      const lastBonusRow = br - 1;
      hideRows(sheet, lastBonusRow + 1, totalRow > 0 ? totalRow - 1 : returnRow - 1);
    }
  }

  if (returnRow > 0) {
    const weightRow = findRowWith(
      sheet,
      (r) => { const t = rowText(sheet, r); return t.includes("общее") && t.includes("вес"); },
      1, sheet.rowCount
    );
    if (weightRow > 0) clearRowWithFill(sheet, weightRow);
    if (weightRow > 0) hideRows(sheet, weightRow, weightRow);

    let rr = returnRow;
    const returnEnd = totalRow > returnRow ? totalRow - 1 : rr + 10;
    for (; rr <= returnEnd; rr++) clearRowWithFill(sheet, rr);
    hideRows(sheet, returnRow, returnEnd);
  }
}
