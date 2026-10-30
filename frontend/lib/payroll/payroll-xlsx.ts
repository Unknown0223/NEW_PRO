"use client";

/** Excel faylning birinchi varag'i → obyektlar (sarlavha qatori bo'yicha). */
export async function readXlsxRows(file: File): Promise<Array<Record<string, unknown>>> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
}

export async function downloadXlsx(filename: string, header: string[], rows: unknown[][], sheetName = "Лист1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Sarlavhalardan birinchi mosini topish (rus/uzbek/eng variantlar). */
export function pickCell(row: Record<string, unknown>, names: string[]): unknown {
  const wanted = names.map(norm);
  for (const [k, v] of Object.entries(row)) if (wanted.includes(norm(k))) return v;
  return undefined;
}

export function cellNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function cellText(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
