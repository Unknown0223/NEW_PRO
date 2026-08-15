import { Prisma } from "@prisma/client";
import {
  excelHeaderToImportKey,
  normalizeHeaderLabel,
  parseImportAgentDaysSlotFromHeader,
  parseImportSlotFromHeader
} from "./clients.import.keys";

export function isPlaceholderCell(s: string): boolean {
  const t = s.trim();
  return t === "" || t === "---" || t === "—" || t === "-" || t.toLowerCase() === "n/a";
}

export function parseOptionalDate(raw: string | null): Date | null {
  if (raw == null || isPlaceholderCell(raw)) return null;
  const s = raw.trim();
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const dt = new Date(y, mo, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

export function parseIsActive(raw: string | null): boolean {
  if (raw == null || isPlaceholderCell(raw)) return true;
  const t = raw.trim().toLowerCase();
  if (
    ["yoq", "false", "0", "no", "off", "нет", "неактив", "неактивный", "inaktiv"].includes(t) ||
    t.startsWith("неакт")
  ) {
    return false;
  }
  if (["da", "ha", "yes", "true", "1", "on", "акт", "актив", "активный"].includes(t)) return true;
  return true;
}

export function parseCreditLimit(raw: string | null): Prisma.Decimal {
  if (raw == null || isPlaceholderCell(raw)) return new Prisma.Decimal(0);
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return new Prisma.Decimal(0);
  return new Prisma.Decimal(n);
}

/** DB: Decimal(11,8) — noto‘g‘ri ustun (hajm, kod) tushganda overflow bo‘lmasin. */
export function parseOptionalLatitudeImport(raw: string | null): Prisma.Decimal | null {
  if (raw == null || isPlaceholderCell(raw)) return null;
  const n = Number.parseFloat(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > 90) return null;
  return new Prisma.Decimal(n);
}

export function parseOptionalLongitudeImport(raw: string | null): Prisma.Decimal | null {
  if (raw == null || isPlaceholderCell(raw)) return null;
  const n = Number.parseFloat(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > 180) return null;
  return new Prisma.Decimal(n);
}

export function trimImportClientCode(raw: string | null): string | null {
  if (raw == null || isPlaceholderCell(raw)) return null;
  const t = raw.trim().slice(0, 32);
  return t || null;
}

export function trimImportPinfl(raw: string | null): string | null {
  if (raw == null || isPlaceholderCell(raw)) return null;
  const t = raw.trim().slice(0, 20);
  return t || null;
}

/** SheetJS (`xlsx`) qatori — ExcelJS `readCellText` o‘rnini bosadi. */
export function xlsxCellToString(cell: unknown): string | null {
  if (cell == null || cell === "") return null;
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  const s = typeof cell === "number" ? String(cell) : String(cell).trim();
  if (isPlaceholderCell(s)) return null;
  return s;
}

export function readArrayCell(row: unknown[] | undefined, colIdx: number | undefined): string | null {
  if (row == null || colIdx == null || colIdx < 0) return null;
  return xlsxCellToString(row[colIdx]);
}

export function readImportRefCell(
  row: unknown[],
  colIndexByKey: Record<string, number>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const v = readArrayCell(row, colIndexByKey[key]);
    if (v != null && !isPlaceholderCell(v)) return v;
  }
  return null;
}

export function readMappedCell(
  row: unknown[],
  colIndexByKey: Record<string, number>,
  key: string
): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(colIndexByKey, key)) return undefined;
  return readArrayCell(row, colIndexByKey[key]);
}

/** Birinchi xaritalangan ustun (bo‘sh katak ham qaytariladi). */
export function readMappedRefCell(
  row: unknown[],
  colIndexByKey: Record<string, number>,
  keys: string[]
): string | null | undefined {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(colIndexByKey, key)) continue;
    return readArrayCell(row, colIndexByKey[key]);
  }
  return undefined;
}

export function headerLabelFromCell(cell: unknown): string {
  if (cell == null) return "";
  return String(cell).trim();
}
