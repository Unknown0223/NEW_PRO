/**
 * Staff Excel import template builder — bitta rol yoki barcha rollar (multi-sheet).
 * Сотрудники: har bir web-rol alohida list.
 */

import * as XLSX from "xlsx";
import type { StaffImportKind, StaffOfficeWebRole } from "./staff.import.kinds";
import {
  STAFF_IMPORT_KINDS,
  STAFF_IMPORT_SHEET_NAME,
  STAFF_IMPORT_TEMPLATE_COLUMNS,
  STAFF_OFFICE_IMPORT_SHEETS,
  officeImportSheetByWebRole
} from "./staff.import.kinds";

function appendAoASheet(wb: XLSX.WorkBook, sheetName: string, headers: string[], example: string[]): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
}

function appendKindSheet(wb: XLSX.WorkBook, kind: StaffImportKind): void {
  if (kind === "operator") {
    for (const office of STAFF_OFFICE_IMPORT_SHEETS) {
      appendOfficeSheet(wb, office.webRole);
    }
    return;
  }
  const cols = STAFF_IMPORT_TEMPLATE_COLUMNS[kind];
  appendAoASheet(
    wb,
    STAFF_IMPORT_SHEET_NAME[kind],
    cols.map((c) => c.header),
    cols.map((c) => c.example)
  );
}

function appendOfficeSheet(wb: XLSX.WorkBook, webRole: StaffOfficeWebRole): void {
  const meta = officeImportSheetByWebRole(webRole);
  if (!meta) return;
  const cols = STAFF_IMPORT_TEMPLATE_COLUMNS.operator.map((c) => {
    if (c.header === "Системная роль") return { ...c, example: meta.webRole };
    if (c.header === "Логин") return { ...c, example: meta.exampleLogin };
    if (c.header === "Код") return { ...c, example: meta.exampleCode };
    if (c.header === "Должность") return { ...c, example: meta.label };
    if (c.header === "Рабочее место") return { ...c, example: meta.exampleSlot };
    if (c.header === "Ф.И.О") return { ...c, example: `${meta.label} Пример` };
    return c;
  });
  appendAoASheet(
    wb,
    meta.sheetName,
    cols.map((c) => c.header),
    cols.map((c) => c.example)
  );
}

export function buildStaffImportTemplateBuffer(kind: StaffImportKind): Buffer {
  const wb = XLSX.utils.book_new();
  if (kind === "operator") {
    // Single download «Оператор» — faqat operator listi (barcha office emas)
    appendOfficeSheet(wb, "operator");
  } else {
    appendKindSheet(wb, kind);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Bitta Сотрудники web-rol shabloni (Менеджер, Директор, …). */
export function buildStaffImportOfficeRoleTemplateBuffer(webRole: StaffOfficeWebRole): Buffer {
  const wb = XLSX.utils.book_new();
  appendOfficeSheet(wb, webRole);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Barcha rollar — maydon + har bir office rol alohida list. */
export function buildStaffImportAllRolesTemplateBuffer(
  kinds: readonly StaffImportKind[] = STAFF_IMPORT_KINDS
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const kind of kinds) {
    appendKindSheet(wb, kind);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function staffImportTemplateFilename(kind: StaffImportKind): string {
  return `staff_${kind}_import_template.xlsx`;
}

export function staffImportOfficeTemplateFilename(webRole: StaffOfficeWebRole): string {
  return `staff_${webRole}_import_template.xlsx`;
}

export function staffImportAllRolesTemplateFilename(): string {
  return "staff_all_roles_import_template.xlsx";
}
