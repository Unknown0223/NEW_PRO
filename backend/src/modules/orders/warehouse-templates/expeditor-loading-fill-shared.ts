import type ExcelJS from "exceljs";
import type { ExpeditorLoadingFillFamily } from "./expeditor-loading-layout-family";
import type { NakladnoyBuildOptions } from "../order-nakladnoy-xlsx.types";
import { fmtDate, fmtDateTime } from "../order-nakladnoy-xlsx.format";
import type { WarehouseAggregateContext } from "./warehouse-template-shared";
import { cellStr, setCell } from "./warehouse-template-fill.helpers";

export function rowText(sheet: ExcelJS.Worksheet, r: number, maxCol = 12): string {
  const parts: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    const t = cellStr(sheet.getCell(r, c).value);
    if (t) parts.push(t);
  }
  return parts.join(" ").toLowerCase();
}

export function findRowWith(
  sheet: ExcelJS.Worksheet,
  pred: (r: number) => boolean,
  from = 1,
  to?: number
): number {
  const end = to ?? sheet.rowCount;
  for (let r = from; r <= end; r++) {
    if (pred(r)) return r;
  }
  return -1;
}

export function fillArgb(cell: ExcelJS.Cell): string | null {
  const f = cell.fill;
  if (!f || f.type !== "pattern" || f.pattern === "none") return null;
  return (f as ExcelJS.FillPattern).fgColor?.argb ?? null;
}

export function isGroupTint(argb: string | null): boolean {
  if (!argb) return false;
  const u = argb.toUpperCase();
  return u.endsWith("CCCCFF") || u.endsWith("CCFFCC") || u.endsWith("E9CEFF");
}

export function clearCellValueOnly(cell: ExcelJS.Cell) {
  if (cell.formula) return;
  cell.value = null;
}

export function cloneCellStyle(from: ExcelJS.Cell, to: ExcelJS.Cell) {
  if (from.font) to.font = { ...from.font };
  if (from.fill) to.fill = { ...from.fill };
  if (from.border) to.border = { ...from.border };
  if (from.alignment) to.alignment = { ...from.alignment };
  if (from.numFmt) to.numFmt = from.numFmt;
}

export function dashToNull(v: string): string | null {
  const t = v.trim();
  return !t || t === "—" ? null : t;
}

export function metaAgentPhones(ctx: WarehouseAggregateContext): string {
  const phones = ctx.orders
    .map((o) => {
      const m = /(\+?\d[\d\s\-()]{8,})/.exec(o.agentLine);
      return m?.[1]?.trim() ?? "";
    })
    .filter(Boolean);
  return [...new Set(phones)].join(", ");
}

/** Matritsa / ro‘yxat — 2–6 qator meta (qiymat odatda 3–4 ustunda). */
export function fillExpeditorMetaBlock(
  sheet: ExcelJS.Worksheet,
  ctx: WarehouseAggregateContext,
  versionLabel: string,
  opts?: { titleRow?: number; valueCol?: number }
) {
  const merged = ctx.merged;
  const valueCol = opts?.valueCol ?? 4;
  const titleRow = opts?.titleRow ?? 1;

  const titleCell = sheet.getCell(titleRow, 1);
  const existingTitle = cellStr(titleCell.value);
  if (!existingTitle || existingTitle.toLowerCase().includes("загрузоч")) {
    setCell(
      sheet,
      titleRow,
      1,
      `Загрузочный лист ${versionLabel} (Время печати: ${fmtDateTime(ctx.now)})`
    );
  }

  for (let r = 2; r <= 6; r++) {
    const label = cellStr(sheet.getCell(r, 1).value) || cellStr(sheet.getCell(r, 2).value);
    const l = label.toLowerCase();
    if (l.includes("дата") && l.includes("заяв")) {
      setCell(sheet, r, valueCol, fmtDate(merged.createdAt));
    } else if (l.includes("дата") && (l.includes("отгруз") || l.includes("загруз"))) {
      setCell(sheet, r, valueCol, merged.dateTo ? fmtDate(merged.dateTo) : "—");
    } else if (l.includes("агент")) {
      setCell(sheet, r, valueCol, dashToNull(ctx.agentLabels.join(", ") || merged.agentLine));
    } else if (l.includes("территор")) {
      setCell(sheet, r, valueCol, dashToNull(ctx.territoryLabels.join(", ") || merged.territory || "—"));
    } else if (l.includes("телефон")) {
      setCell(sheet, r, valueCol, dashToNull(metaAgentPhones(ctx)));
    } else if (l.includes("экспедитор") || l.includes("водитель")) {
      setCell(sheet, r, valueCol, dashToNull(ctx.expeditorLabels.join(", ") || merged.expeditorLine));
    }
  }
}

export function normalizeAgentKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();
}

export function agentMatchesHeader(orderAgentLine: string, headerText: string): boolean {
  const a = normalizeAgentKey(orderAgentLine);
  const h = normalizeAgentKey(headerText);
  if (!a || !h) return false;
  if (h.includes(a) || a.includes(h)) return true;
  const aFirst = a.split(/[,;]/)[0]!.trim();
  const hFirst = h.split(/[,;]/)[0]!.trim();
  return hFirst.includes(aFirst) || aFirst.includes(hFirst);
}

/** Asosiy ma’lumot varag‘i — versiya nomi yoki «продукт» sarlavhasi bo‘yicha. */
export function pickExpeditorDataSheet(wb: ExcelJS.Workbook, versionLabel: string): ExcelJS.Worksheet {
  const ver = versionLabel.replace(/\s/g, "");
  for (const ws of wb.worksheets) {
    const n = (ws.name || "").replace(/\s/g, "");
    if (n.includes(ver) && ws.rowCount > 8) return ws;
  }
  for (const ws of wb.worksheets) {
    const low = (ws.name || "").toLowerCase();
    if (low.includes("worksheet") && ws.rowCount < 2) continue;
    if (low.includes("накладн") && ws.rowCount > 100) continue;
    for (let r = 1; r <= 20; r++) {
      const t = rowText(ws, r, 30);
      if (
        t.includes("продукт") &&
        (t.includes("общее") || t.includes("колич") || t.includes("кг") || t.includes("кол-"))
      ) {
        return ws;
      }
      if (t.includes("имя клиента") && t.includes("адресс")) return ws;
      if (t.includes("название продукции")) return ws;
    }
  }
  return wb.worksheets.find((ws) => ws.rowCount > 8) ?? wb.worksheets[0]!;
}

export function detectFillFamilyFromSheet(sheet: ExcelJS.Worksheet): ExpeditorLoadingFillFamily | null {
  for (let r = 1; r <= 15; r++) {
    const t = rowText(sheet, r, 40);
    if (t.includes("имя клиента") || (t.includes("адресс") && t.includes("№"))) return "matrixClients";
    if (t.includes("название продукции") && t.includes("итого")) return "matrix300";
    const hasAgentNumberHeaders =
      /продукт/.test(t) &&
      (/\bкг\b/.test(t) || t.includes("общее")) &&
      /\s[1-9]\d*\s/.test(` ${t} `);
    if (hasAgentNumberHeaders) return "matrixAgents";
    if (t.includes("продукт") && (t.includes("колич") || t.includes("кг") || t.includes("кол-"))) {
      const hasBarcodeOrListHeader =
        t.includes("штрих") || (t.includes("код") && t.includes("сумм") && !hasAgentNumberHeaders);
      if (hasBarcodeOrListHeader) return "list518";
    }
  }
  return null;
}

export function findProductRow(sheet: ExcelJS.Worksheet, productName: string, fromRow: number, nameCols: number[]): number {
  const needle = productName.trim().toLowerCase();
  for (let r = fromRow; r <= sheet.rowCount; r++) {
    for (const c of nameCols) {
      if (cellStr(sheet.getCell(r, c).value).toLowerCase() === needle) return r;
    }
  }
  return -1;
}
