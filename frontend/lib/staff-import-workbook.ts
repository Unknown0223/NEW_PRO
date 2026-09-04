/**
 * Client-side staff Excel workbook parse / rebuild for work-slots import preview.
 * Sheet names mirror backend STAFF_IMPORT_SHEET_NAME + STAFF_OFFICE_IMPORT_SHEETS.
 */

import * as XLSX from "xlsx";

export const STAFF_IMPORT_KINDS = [
  "agent",
  "expeditor",
  "supervisor",
  "collector",
  "auditor",
  "skladchik",
  "operator"
] as const;

export type StaffImportKind = (typeof STAFF_IMPORT_KINDS)[number];

export const STAFF_OFFICE_IMPORT_SHEETS = [
  { webRole: "operator", sheetName: "Операторы", label: "Оператор" },
  { webRole: "director", sheetName: "Директоры", label: "Директор" },
  { webRole: "sales_director", sheetName: "Директор по продажам", label: "Директор по продажам" },
  { webRole: "manager", sheetName: "Менеджеры", label: "Менеджер" },
  { webRole: "regional_manager", sheetName: "Региональные менеджеры", label: "Региональный менеджер" },
  { webRole: "accountant", sheetName: "Бухгалтеры", label: "Бухгалтер" },
  { webRole: "warehouse_manager", sheetName: "Менеджеры склада", label: "Менеджер склада" }
] as const;

export type StaffOfficeWebRole = (typeof STAFF_OFFICE_IMPORT_SHEETS)[number]["webRole"];

export const STAFF_IMPORT_SHEET_NAME: Record<StaffImportKind, string> = {
  agent: "Агенты",
  expeditor: "Экспедиторы",
  supervisor: "Супервайзеры",
  collector: "Инкассаторы",
  auditor: "Аудиторы",
  skladchik: "Складчики",
  operator: "Операторы"
};

export const STAFF_IMPORT_KIND_LABEL: Record<StaffImportKind, string> = {
  agent: "Агенты",
  expeditor: "Экспедиторы",
  supervisor: "Супервайзеры",
  collector: "Инкассаторы",
  auditor: "Аудиторы",
  skladchik: "Складчики",
  operator: "Оператор"
};

/** Role picker: field kinds + office web-roles (template/import). */
export type StaffImportRoleChoice = StaffImportKind | StaffOfficeWebRole | "all";

export const STAFF_IMPORT_ROLE_OPTIONS: { value: StaffImportRoleChoice; label: string }[] = [
  { value: "all", label: "Все роли" },
  { value: "agent", label: "Агенты" },
  { value: "expeditor", label: "Экспедиторы" },
  { value: "supervisor", label: "Супервайзеры" },
  { value: "collector", label: "Инкассаторы" },
  { value: "auditor", label: "Аудиторы" },
  { value: "skladchik", label: "Складчики" },
  ...STAFF_OFFICE_IMPORT_SHEETS.map((s) => ({
    value: s.webRole as StaffImportRoleChoice,
    label: s.label
  }))
];

const SHEET_NAME_ALIASES: Record<StaffImportKind, string[]> = {
  agent: ["агент", "агенты", "agents", "agent"],
  expeditor: ["экспедитор", "экспедиторы", "expeditors", "expeditor", "ekspeditor"],
  supervisor: ["супервайзер", "супервайзеры", "supervisors", "supervisor", "supervayzer"],
  collector: ["инкассатор", "инкассаторы", "collectors", "collector", "inkassator"],
  auditor: ["аудитор", "аудиторы", "auditors", "auditor"],
  skladchik: ["складчик", "складчики", "skladchik"],
  operator: ["сотрудник", "сотрудники", "оператор", "операторы", "operators", "operator", "sotrudniki"]
};

function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е")
    .replace(/\.+$/g, "");
}

export function isStaffImportKind(v: string): v is StaffImportKind {
  return (STAFF_IMPORT_KINDS as readonly string[]).includes(v);
}

export function isStaffOfficeWebRole(v: string): v is StaffOfficeWebRole {
  return STAFF_OFFICE_IMPORT_SHEETS.some((s) => s.webRole === v);
}

export function resolveOfficeWebRoleFromSheetName(name: string): StaffOfficeWebRole | null {
  const n = normHeader(name);
  for (const s of STAFF_OFFICE_IMPORT_SHEETS) {
    if (normHeader(s.sheetName) === n) return s.webRole;
    if (s.webRole === n) return s.webRole;
    if (normHeader(s.label) === n) return s.webRole;
  }
  if (n === "сотрудники" || n === "сотрудник") return "operator";
  return null;
}

export function resolveStaffImportKindFromSheetName(name: string): StaffImportKind | null {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const n = normHeader(raw).slice(0, 31);

  if (resolveOfficeWebRoleFromSheetName(raw)) return "operator";

  for (const kind of STAFF_IMPORT_KINDS) {
    if (kind === "operator") continue;
    if (normHeader(STAFF_IMPORT_SHEET_NAME[kind]).slice(0, 31) === n) return kind;
  }
  if (isStaffImportKind(n)) return n;
  const lower = raw.toLowerCase().trim();
  if (isStaffImportKind(lower)) return lower;

  for (const kind of STAFF_IMPORT_KINDS) {
    for (const alias of SHEET_NAME_ALIASES[kind]) {
      if (normHeader(alias) === n) return kind;
    }
  }
  return null;
}

export type StaffImportPreviewSheet = {
  name: string;
  kind: StaffImportKind;
  headers: string[];
  rows: string[][];
  defaultWebRole?: StaffOfficeWebRole;
};

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\u00a0/g, " ").trim();
}

function matrixToSheet(
  sheetName: string,
  kind: StaffImportKind,
  matrix: unknown[][],
  defaultWebRole?: StaffOfficeWebRole
): StaffImportPreviewSheet {
  const headerRow = (matrix[0] ?? []) as unknown[];
  const headers = headerRow.map((c) => cellToString(c));
  let colCount = headers.length;
  while (colCount > 0 && !headers[colCount - 1]) colCount--;
  const safeHeaders = (colCount > 0 ? headers.slice(0, colCount) : headers).map(
    (h, i) => h || `Колонка ${i + 1}`
  );

  const rows: string[][] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const cells = safeHeaders.map((_, ci) => cellToString(line[ci]));
    if (!cells.some((c) => c.trim())) continue;
    rows.push(cells);
  }

  return {
    name: sheetName,
    kind,
    headers: safeHeaders,
    rows,
    ...(defaultWebRole ? { defaultWebRole } : {})
  };
}

async function readFileBuffer(file: File | Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (file instanceof ArrayBuffer) return file;
  if (typeof (file as Blob).arrayBuffer === "function") {
    return (file as Blob).arrayBuffer();
  }
  const blob = file as Blob;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsArrayBuffer(blob);
  });
}

/** Parse XLSX into staff role sheets (unknown sheets skipped). */
export async function parseStaffImportWorkbook(
  file: File | Blob | ArrayBuffer
): Promise<StaffImportPreviewSheet[]> {
  const buf = await readFileBuffer(file);
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: true });
  const out: StaffImportPreviewSheet[] = [];
  const seenField = new Set<StaffImportKind>();
  const seenOffice = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const officeRole = resolveOfficeWebRoleFromSheetName(sheetName);
    const kind = resolveStaffImportKindFromSheetName(sheetName);
    if (!kind) continue;

    if (kind === "operator") {
      const key = officeRole ?? `legacy:${normHeader(sheetName)}`;
      if (seenOffice.has(key)) continue;
      seenOffice.add(key);
    } else {
      if (seenField.has(kind)) continue;
      seenField.add(kind);
    }

    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: ""
    }) as unknown[][];
    if (!matrix.length) continue;
    out.push(matrixToSheet(sheetName, kind, matrix, officeRole ?? undefined));
  }

  return out;
}

export async function parseStaffImportWorkbookForKind(
  file: File | Blob | ArrayBuffer,
  preferredKind: StaffImportRoleChoice
): Promise<StaffImportPreviewSheet[]> {
  const sheets = await parseStaffImportWorkbook(file);
  if (sheets.length > 0) {
    if (preferredKind === "all") return sheets;
    if (isStaffOfficeWebRole(preferredKind)) {
      const match = sheets.filter(
        (s) => s.kind === "operator" && (s.defaultWebRole ?? "operator") === preferredKind
      );
      return match.length ? match : sheets.filter((s) => s.kind === "operator");
    }
    const match = sheets.filter((s) => s.kind === preferredKind);
    return match.length ? match : sheets;
  }

  if (preferredKind === "all") return [];

  const buf = await readFileBuffer(file);
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName || !wb.Sheets[sheetName]) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: ""
  }) as unknown[][];
  if (!matrix.length) return [];

  if (isStaffOfficeWebRole(preferredKind)) {
    return [matrixToSheet(sheetName, "operator", matrix, preferredKind)];
  }
  return [matrixToSheet(sheetName, preferredKind, matrix)];
}

/** Rebuild XLSX Blob/File from edited preview sheets. */
export function rebuildStaffImportWorkbookFile(
  sheets: StaffImportPreviewSheet[],
  fileName = "staff_import_preview.xlsx"
): File {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of sheets) {
    const aoa: string[][] = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const officeMeta = sheet.defaultWebRole
      ? STAFF_OFFICE_IMPORT_SHEETS.find((s) => s.webRole === sheet.defaultWebRole)
      : null;
    let safeName = (officeMeta?.sheetName || STAFF_IMPORT_SHEET_NAME[sheet.kind] || sheet.name)
      .replace(/[:\\/?*[\]]/g, "_")
      .slice(0, 31);
    if (used.has(safeName)) {
      safeName = `${safeName.slice(0, 28)}_${used.size}`.slice(0, 31);
    }
    used.add(safeName);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([out], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

export function patchPreviewCell(
  sheets: StaffImportPreviewSheet[],
  sheetIndex: number,
  rowIndex: number,
  colIndex: number,
  value: string
): StaffImportPreviewSheet[] {
  return sheets.map((s, si) => {
    if (si !== sheetIndex) return s;
    const rows = s.rows.map((r, ri) => {
      if (ri !== rowIndex) return r;
      return r.map((c, ci) => (ci === colIndex ? value : c));
    });
    return { ...s, rows };
  });
}

export function previewSheetLabel(sheet: StaffImportPreviewSheet): string {
  if (sheet.defaultWebRole) {
    return (
      STAFF_OFFICE_IMPORT_SHEETS.find((s) => s.webRole === sheet.defaultWebRole)?.label ??
      sheet.name
    );
  }
  return STAFF_IMPORT_KIND_LABEL[sheet.kind] ?? sheet.name;
}
