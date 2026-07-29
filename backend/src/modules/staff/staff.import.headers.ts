/**
 * Excel header matching + cell helpers for staff import.
 */

import * as XLSX from "xlsx";
import type { StaffImportKind } from "./staff.import.kinds";
import { headerAliasesForKind } from "./staff.import.kinds";

export function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е")
    .replace(/\.+$/g, "");
}

function isWordChar(c: string): boolean {
  return /[0-9a-zа-яёії]/i.test(c);
}

function headerMatchesField(cellNorm: string, aliasRaw: string): boolean {
  const a = normHeader(aliasRaw);
  if (!cellNorm || !a) return false;
  if (cellNorm === a) return true;
  if (a.length <= 3) return false;
  if (cellNorm.startsWith(`${a} `) || cellNorm.startsWith(`${a}(`) || cellNorm.startsWith(`${a},`)) {
    return true;
  }
  if (cellNorm.includes(` ${a} `) || cellNorm.endsWith(` ${a}`)) return true;
  const idx = cellNorm.indexOf(a);
  if (idx === -1) return false;
  const before = idx === 0 ? " " : cellNorm[idx - 1]!;
  const after = idx + a.length >= cellNorm.length ? " " : cellNorm[idx + a.length]!;
  if (isWordChar(before) || isWordChar(after)) return false;
  return true;
}

export function buildHeaderMap(
  headerRow: unknown[],
  aliases: Record<string, string[]>
): Record<string, number> {
  const map: Record<string, number> = {};
  const cells = headerRow.map((c) => (c == null ? "" : String(c)));
  for (let i = 0; i < cells.length; i++) {
    const cellNorm = normHeader(cells[i]!);
    if (!cellNorm) continue;
    for (const [field, als] of Object.entries(aliases)) {
      if (map[field] !== undefined) continue;
      for (const alias of als) {
        if (headerMatchesField(cellNorm, alias)) {
          map[field] = i;
          break;
        }
      }
    }
  }
  return map;
}

export function cell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= row.length) return "";
  const v = row[idx];
  if (v == null) return "";
  return String(v)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

export function yesRu(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "да" || s === "yes" || s === "true" || s === "1" || s === "ha";
}

export function parseNameFromFio(raw: string): {
  displayName: string;
  first_name: string;
  last_name: string | null;
  middle_name: string | null;
} {
  const t = raw.replace(/\u00a0/g, " ").trim();
  const m = t.match(/\[([^\]]+)\]/);
  const core = (m ? m[1] : t).trim();
  const parts = core.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { displayName: t, first_name: t || "?", last_name: null, middle_name: null };
  }
  if (parts.length === 1) {
    return { displayName: core, first_name: parts[0]!, last_name: null, middle_name: null };
  }
  // RU convention: Фамилия Имя Отчество
  const last_name = parts[0]!;
  const first_name = parts[1]!;
  const middle_name = parts.length > 2 ? parts.slice(2).join(" ") : null;
  return { displayName: core || t, first_name, last_name, middle_name };
}

export function normPinfl(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  return d.length >= 10 ? d.slice(0, 20) : null;
}

export function readMatrixFromBuffer(buffer: Buffer): { sheetName: string; matrix: unknown[][] } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0] || "Sheet1";
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { sheetName, matrix: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return { sheetName, matrix };
}

export function buildStaffImportHeaderMap(
  headerRow: unknown[],
  kind: StaffImportKind
): Record<string, number> {
  return buildHeaderMap(headerRow, headerAliasesForKind(kind));
}

export function suggestLogin(kind: StaffImportKind, code: string, fio: string): string {
  const c = code.replace(/\s+/g, "").replace(/[^\w.-]/g, "_").toLowerCase();
  const prefix =
    kind === "supervisor"
      ? "sup"
      : kind === "expeditor"
        ? "exp"
        : kind === "collector"
          ? "col"
          : kind === "auditor"
            ? "aud"
            : kind === "skladchik"
              ? "skl"
              : kind === "operator"
                ? "op"
                : "agt";
  if (c) return `${prefix}_${c}`.slice(0, 64);
  const parts = fio.split(/\s+/).filter(Boolean);
  const slug = parts
    .slice(0, 2)
    .join("_")
    .replace(/[^\wа-яёА-ЯЁa-zA-Z0-9_]/g, "")
    .toLowerCase();
  return `${prefix}_${slug || "user"}`.slice(0, 64);
}
