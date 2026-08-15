"use client";

/**
 * Экспорт табеля в настоящий Excel (.xlsx) через ExcelJS.
 * В ОБОИХ режимах в ячейки дней пишется тот же символ, что и в UI-табеле
 * (`STATUS_META.short`): рабочие значения — числа 1 / 0.5 / 0, спец-статусы —
 * буквы «В» (выходной) / «О» (отпуск) / «Б» (больничный) / «К» (командировка).
 *  - режим «codes»  — только символы в ячейках;
 *  - режим «labels» — те же символы в ячейках + Excel-примечания («Примечание»):
 *      · буквенные статусы (В/О/Б/К) → полное русское название буквы;
 *      · шифра (0 / 0.5 / 1) → название НЕ добавляется;
 *      · комментарий по ячейке всегда попадает в примечание;
 *      · буква + комментарий → две отдельные строки (буква, затем комментарий).
 */

import {
  STATUS_META,
  fmtTotal,
  statusWorkValue,
  type TimesheetRow
} from "@/components/timesheet/timesheet-shared";

export type TimesheetExportMode = "codes" | "labels";

/** Карта комментариев по ячейкам: ключ `${fio}:${date}` → текст примечания. */
export type TimesheetCommentMap = Record<string, string>;

/** Авто-заглушки комментариев — не выгружаем как Excel-примечания. */
const AUTO_COMMENTS = new Set(["Изменено в табеле", "Массовое редактирование в табеле"]);

type AuditLike = {
  module: string;
  title: string;
  subtitle?: string;
  comment?: string;
  changedAt: string;
};

/**
 * Собрать карту комментариев по ячейкам из журнала табеля: ключ `${fio}:${date}`
 * → последний осмысленный комментарий (авто-заглушки пропускаем).
 */
export function buildTimesheetCommentMap(records: AuditLike[] | undefined): TimesheetCommentMap {
  const map: TimesheetCommentMap = {};
  const latest: Record<string, string> = {};
  for (const a of records ?? []) {
    if (a.module !== "timesheet" || !a.subtitle) continue;
    const comment = a.comment?.trim();
    if (!comment || AUTO_COMMENTS.has(comment)) continue;
    const key = `${a.title}:${a.subtitle}`;
    if (!latest[key] || a.changedAt > latest[key]) {
      latest[key] = a.changedAt;
      map[key] = comment;
    }
  }
  return map;
}

type ExcelJS = typeof import("exceljs");

const FILL_HEADER = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E8C7A" } } as const;

/** HEX «#0e8c7a» → ARGB «FF0E8C7A» для заливки ExcelJS. */
function hexToArgb(hex: string): string {
  const clean = hex.replace("#", "").toUpperCase();
  return `FF${clean.padStart(6, "0")}`;
}

/** Подобрать читаемый цвет текста (тёмный/светлый) по яркости фона. */
function textColorFor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "FF1E293B" : "FFFFFFFF";
}

function triggerDownload(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Собрать .xlsx-буфер табеля. Вынесено отдельно для тестирования в Node.
 */
export async function buildTimesheetXlsx(
  month: string,
  days: number[],
  rows: TimesheetRow[],
  mode: TimesheetExportMode,
  comments?: TimesheetCommentMap
): Promise<ArrayBuffer> {
  const ExcelJSMod = (await import("exceljs")) as { default: ExcelJS };
  const ExcelJS = ExcelJSMod.default;

  const wb = new ExcelJS.Workbook();
  wb.creator = "SALEC";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Табель ${month}`.slice(0, 31), {
    views: [{ state: "frozen", xSplit: 4, ySplit: 1, topLeftCell: "E2" }],
    properties: { defaultRowHeight: 16 }
  });

  const dayCols = days.map((d) => String(d).padStart(2, "0"));
  const headers = ["ФИО", "Роль", "Логин", "Итого", ...dayCols];

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = FILL_HEADER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  rows.forEach((r, rIdx) => {
    const row = ws.getRow(rIdx + 2);
    const total = r.cells.reduce((acc, c) => acc + statusWorkValue(c.status), 0);

    row.getCell(1).value = r.fio;
    row.getCell(2).value = r.role;
    row.getCell(3).value = r.login;
    row.getCell(4).value = fmtTotal(total);
    for (let i = 1; i <= 4; i++) {
      row.getCell(i).font = { size: 11, name: "Calibri" };
      row.getCell(i).alignment = { vertical: "middle" };
    }
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).font = { size: 11, name: "Calibri", bold: true };

    r.cells.forEach((c, cIdx) => {
      const cell = row.getCell(5 + cIdx);
      const meta = STATUS_META[c.status];
      // В обоих режимах ячейка = символ из UI-табеля (STATUS_META.short):
      // рабочие значения (1 / 0.5 / 0) — числом (удобно для формул),
      // спец-статусы — буквой (В / О / Б / К), как показывает интерфейс.
      const shortNum = Number(meta.short);
      cell.value = meta.short !== "" && !Number.isNaN(shortNum) ? shortNum : meta.short;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { size: 11, name: "Calibri", color: { argb: textColorFor(meta.color) } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(meta.color) } };

      // Примечание в режиме «labels» (Коды + примечания):
      //  · буквенные статусы (В/О/Б/К — short не число) → расшифровка буквы;
      //  · шифра (0 / 0.5 / 1) → название НЕ добавляем;
      //  · если есть комментарий пользователя — он всегда попадает в примечание;
      //  · буква + комментарий → две отдельные строки (буква, затем комментарий).
      if (mode === "labels") {
        const isLetter = meta.short !== "" && Number.isNaN(shortNum);
        const userNote = comments?.[`${r.fio}:${c.date}`]?.trim();
        const parts: string[] = [];
        if (isLetter) parts.push(meta.label);
        if (userNote) parts.push(userNote);
        if (parts.length > 0) {
          cell.note = {
            texts: [{ text: parts.join("\n") }],
            margins: { insetmode: "auto" }
          };
        }
      }
    });
  });

  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 8;
  for (let i = 0; i < dayCols.length; i++) ws.getColumn(5 + i).width = 5;

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Собрать и скачать .xlsx табеля в браузере. Имя файла: `Tabel_YYYY-MM.xlsx`. */
export async function exportTimesheetXlsx(
  month: string,
  days: number[],
  rows: TimesheetRow[],
  mode: TimesheetExportMode,
  comments?: TimesheetCommentMap
): Promise<void> {
  const buffer = await buildTimesheetXlsx(month, days, rows, mode, comments);
  triggerDownload(buffer, `Tabel_${month}.xlsx`);
}
