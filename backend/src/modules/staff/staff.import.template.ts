/**
 * Staff Excel import template builder.
 */

import * as XLSX from "xlsx";
import type { StaffImportKind } from "./staff.import.kinds";
import {
  STAFF_IMPORT_SHEET_NAME,
  STAFF_IMPORT_TEMPLATE_COLUMNS
} from "./staff.import.kinds";

export function buildStaffImportTemplateBuffer(kind: StaffImportKind): Buffer {
  const cols = STAFF_IMPORT_TEMPLATE_COLUMNS[kind];
  const headers = cols.map((c) => c.header);
  const example = cols.map((c) => c.example);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  // Slightly wider first columns for readability
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, STAFF_IMPORT_SHEET_NAME[kind].slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function staffImportTemplateFilename(kind: StaffImportKind): string {
  return `staff_${kind}_import_template.xlsx`;
}
