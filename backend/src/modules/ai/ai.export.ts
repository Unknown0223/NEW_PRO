/** AI Assistant — jadval → xlsx / csv. */
import ExcelJS from "exceljs";
import { AI_CONFIG } from "./ai.config";
import type { AiTableResult } from "./ai.types";

export type ExportFormat = "xlsx" | "csv";

function safeSheetName(raw: string, index: number): string {
  const cleaned = raw.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 28);
  return `${index + 1}. ${cleaned || "Ma’lumot"}`;
}

function csvCell(value: string): string {
  const text = String(value ?? "");
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function clampRows(rows: string[][]): { rows: string[][]; truncated: boolean } {
  const limit = AI_CONFIG.maxExportRows;
  return rows.length > limit ? { rows: rows.slice(0, limit), truncated: true } : { rows, truncated: false };
}

/** Ko‘p guruhli CSV (bo‘limlar orasida bo‘sh qator). */
export function buildCsv(groups: AiTableResult[], title: string): { content: string; rows: number; truncated: boolean } {
  const lines: string[] = [];
  let total = 0;
  let truncated = false;
  lines.push(csvCell(title));
  lines.push("");
  for (const group of groups) {
    const clamped = clampRows(group.rows);
    truncated = truncated || clamped.truncated;
    lines.push(csvCell(group.title));
    if (group.summary) lines.push(csvCell(group.summary));
    if (group.columns.length) {
      lines.push(group.columns.map(csvCell).join(";"));
      for (const row of clamped.rows) {
        lines.push(group.columns.map((_, index) => csvCell(row[index] ?? "")).join(";"));
      }
      total += clamped.rows.length;
    }
    lines.push("");
  }
  // BOM — Excel’da kirill/lotin to‘g‘ri ko‘rinishi uchun.
  return { content: `\uFEFF${lines.join("\r\n")}`, rows: total, truncated };
}

/** Xlsx: birinchi varaq — xulosa, keyingi varaqlar — jadvallar. */
export async function buildXlsx(
  groups: AiTableResult[],
  title: string,
  summary: string[]
): Promise<{ buffer: Buffer; rows: number; truncated: boolean }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SALEC AI Assistant";
  workbook.created = new Date();

  const overview = workbook.addWorksheet("Xulosa");
  overview.columns = [{ header: "Bo‘lim", key: "section", width: 32 }, { header: "Ma’lumot", key: "value", width: 64 }];
  overview.getRow(1).font = { bold: true };
  overview.addRow({ section: "Savol", value: title });
  for (const line of summary.slice(0, 50)) overview.addRow({ section: "", value: line });
  overview.addRow({ section: "", value: "" });
  overview.addRow({ section: "Guruhlar", value: groups.map((group) => group.title).join(", ") });

  let total = 0;
  let truncated = false;
  groups.forEach((group, index) => {
    const sheet = workbook.addWorksheet(safeSheetName(group.title, index));
    sheet.columns = group.columns.length
      ? group.columns.map((column) => ({ header: column, key: column, width: Math.min(42, Math.max(14, column.length + 6)) }))
      : [{ header: "Ma’lumot", key: "value", width: 40 }];
    sheet.getRow(1).font = { bold: true };
    if (group.summary) {
      const summaryRow = sheet.addRow([group.summary]);
      summaryRow.font = { italic: true };
    }
    const clamped = clampRows(group.rows);
    truncated = truncated || clamped.truncated;
    for (const row of clamped.rows) {
      sheet.addRow(group.columns.length ? row : [row.join(" · ")]);
    }
    total += clamped.rows.length;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), rows: total, truncated };
}

export function exportFilename(title: string, format: ExportFormat, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яёʻ'’ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "hisobot";
  return `${base}-${stamp}.${format}`;
}
