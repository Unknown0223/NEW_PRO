/**
 * Excel/CSV → ingest items. Ошибки строк возвращаются в отчёте, без throw на весь файл.
 */
import * as XLSX from "xlsx";
import type { BankTransferIngestItem } from "../../contracts/bank-transfer-inbox.schemas";

export type ParsedImportRowError = {
  row: number;
  message: string;
  raw?: Record<string, string>;
};

export type ParsedImportResult = {
  items: BankTransferIngestItem[];
  errors: ParsedImportRowError[];
};

const HEADER_ALIASES: Record<string, keyof BankTransferIngestItem | "skip"> = {
  external_id: "external_id",
  id: "external_id",
  ext_id: "external_id",
  amount: "amount",
  summa: "amount",
  сумма: "amount",
  currency: "currency",
  валюта: "currency",
  paid_at: "paid_at",
  date: "paid_at",
  дата: "paid_at",
  payer_name: "payer_name",
  name: "payer_name",
  плательщик: "payer_name",
  payer_inn: "payer_inn",
  inn: "payer_inn",
  инн: "payer_inn",
  stir: "payer_inn",
  payer_pinfl: "payer_pinfl",
  pinfl: "payer_pinfl",
  пинфл: "payer_pinfl",
  payer_bank_account: "payer_bank_account",
  bank_account: "payer_bank_account",
  account: "payer_bank_account",
  счёт: "payer_bank_account",
  счет: "payer_bank_account",
  рс: "payer_bank_account",
  payer_bank_mfo: "payer_bank_mfo",
  mfo: "payer_bank_mfo",
  мфо: "payer_bank_mfo",
  payer_client_code: "payer_client_code",
  client_code: "payer_client_code",
  код: "payer_client_code",
  purpose: "purpose",
  назначение: "purpose",
  comment: "purpose"
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapHeaders(headers: string[]): Map<number, keyof BankTransferIngestItem> {
  const map = new Map<number, keyof BankTransferIngestItem>();
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[normHeader(h)];
    if (key && key !== "skip") map.set(i, key);
  });
  return map;
}

/** CSV: delimiter auto `;` или `,`. */
export function parseBankTransferCsv(text: string): ParsedImportResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { items: [], errors: [{ row: 1, message: "Нужен заголовок и хотя бы одна строка" }] };
  }

  const headerLine = lines[0]!;
  const delim = headerLine.includes(";") && !headerLine.includes(",") ? ";" : ",";
  const split = (line: string) =>
    line.split(delim).map((c) => c.replace(/^"|"$/g, "").trim());

  const headers = split(headerLine);
  const colMap = mapHeaders(headers);
  if (![...colMap.values()].includes("amount")) {
    return {
      items: [],
      errors: [{ row: 1, message: "Колонка amount/summa/сумма обязательна" }]
    };
  }

  const items: BankTransferIngestItem[] = [];
  const errors: ParsedImportRowError[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = split(lines[li]!);
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      raw[h] = cells[i] ?? "";
    });
    const draft: Partial<BankTransferIngestItem> & { raw?: Record<string, string> } = { raw };
    for (const [idx, field] of colMap) {
      const val = cells[idx] ?? "";
      if (field === "amount") {
        const n = parseAmount(val);
        if (n == null) {
          errors.push({ row: li + 1, message: "Некорректная сумма", raw });
          continue;
        }
        draft.amount = n;
      } else {
        (draft as Record<string, unknown>)[field] = val || null;
      }
    }
    if (draft.amount == null || !(draft.amount > 0)) {
      if (!errors.some((e) => e.row === li + 1)) {
        errors.push({ row: li + 1, message: "Сумма обязательна", raw });
      }
      continue;
    }
    items.push(draft as BankTransferIngestItem);
  }

  return { items, errors };
}

/** Массив объектов (после xlsx sheet_to_json). */
export function parseBankTransferObjectRows(
  rows: Record<string, unknown>[]
): ParsedImportResult {
  if (rows.length === 0) {
    return { items: [], errors: [{ row: 1, message: "Пустой файл" }] };
  }
  const headers = Object.keys(rows[0]!);
  const aliasToField = new Map<string, keyof BankTransferIngestItem>();
  for (const h of headers) {
    const field = HEADER_ALIASES[normHeader(h)];
    if (field && field !== "skip") aliasToField.set(h, field);
  }
  if (![...aliasToField.values()].includes("amount")) {
    return {
      items: [],
      errors: [{ row: 1, message: "Колонка amount/summa/сумма обязательна" }]
    };
  }

  const items: BankTransferIngestItem[] = [];
  const errors: ParsedImportRowError[] = [];

  rows.forEach((row, i) => {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      raw[k] = v == null ? "" : String(v);
    }
    const draft: Partial<BankTransferIngestItem> = { raw };
    for (const [header, field] of aliasToField) {
      const val = raw[header] ?? "";
      if (field === "amount") {
        const n = parseAmount(val);
        if (n == null) {
          errors.push({ row: i + 2, message: "Некорректная сумма", raw });
          return;
        }
        draft.amount = n;
      } else {
        (draft as Record<string, unknown>)[field] = val || null;
      }
    }
    if (draft.amount == null || !(draft.amount > 0)) {
      errors.push({ row: i + 2, message: "Сумма обязательна", raw });
      return;
    }
    items.push(draft as BankTransferIngestItem);
  });

  return { items, errors };
}

/** .xlsx / .xls buffer → object rows → ingest items (первый лист). */
export function parseBankTransferXlsx(buffer: Buffer | ArrayBuffer | Uint8Array): ParsedImportResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return { items: [], errors: [{ row: 1, message: "Не удалось прочитать Excel-файл" }] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName || !wb.Sheets[sheetName]) {
    return { items: [], errors: [{ row: 1, message: "В файле нет листов" }] };
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, {
    defval: "",
    raw: false
  });
  return parseBankTransferObjectRows(rows);
}

/** Base64 (data URL или чистый base64) → parseBankTransferXlsx. */
export function parseBankTransferXlsxBase64(b64: string): ParsedImportResult {
  const trimmed = b64.trim();
  const comma = trimmed.indexOf(",");
  const payload =
    trimmed.startsWith("data:") && comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  if (!payload) {
    return { items: [], errors: [{ row: 1, message: "Пустой xlsx_base64" }] };
  }
  try {
    return parseBankTransferXlsx(Buffer.from(payload, "base64"));
  } catch {
    return { items: [], errors: [{ row: 1, message: "Некорректный base64 Excel" }] };
  }
}
