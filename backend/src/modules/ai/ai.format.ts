/**
 * AI Assistant — javobni jadvalga aylantirish (pure).
 *
 * Hech qachon xom obyekt qaytarmaydi: barcha qiymatlar satrga aylantiriladi,
 * maxfiy maydonlar (parol/token/PINFL/INN) olib tashlanadi.
 */
import { money, truncate } from "./ai.text";
import type { AiTableResult } from "./ai.types";

const SECRET_KEY = /(password|passwd|token|secret|hash|pinfl|passport|inn|refresh)/i;
const MONEY_KEY = /(sum|amount|price|debt|balance|revenue|cost|total|outstanding|salary|limit|paid|refund|profit)/i;
const DATE_KEY = /(date|_at$|created|updated|paid_at|delivered_at)/i;
const ID_KEY = /(^id$|_id$|number|raqam|sku|code|login)/i;

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  number: "Raqam",
  name: "Nomi",
  client_name: "Mijoz",
  agent_name: "Agent",
  expeditor_name: "Ekspeditor",
  fio: "F.I.SH",
  login: "Login",
  role: "Rol",
  status: "Holat",
  phone: "Telefon",
  sku: "SKU",
  qty: "Miqdor",
  quantity: "Miqdor",
  price: "Narx",
  amount: "Summa",
  total_sum: "Summa",
  outstanding: "Qarz",
  balance: "Balans",
  debt: "Qarz",
  revenue: "Tushum",
  date: "Sana",
  created_at: "Sana",
  paid_at: "To‘lov sanasi",
  category: "Kategoriya",
  is_active: "Faol",
  expense_type: "Rasm turi",
  expense_date: "Sana",
  order_count: "Buyurtma",
  payment_sum: "To‘lov",
  return_amount: "Vozvrat",
  net_revenue: "Sof tushum",
  warehouse_name: "Ombor",
  unit: "O‘lchov"
};

export function columnLabel(key: string): string {
  return COLUMN_LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

function formatDateCell(value: unknown): string {
  const s = String(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return truncate(s, 24);
}

function cell(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ha" : "Yo‘q";
  if (typeof value === "object") return "—";
  if (MONEY_KEY.test(key) && Number.isFinite(Number(value))) return money(value, "");
  if (DATE_KEY.test(key)) return formatDateCell(value);
  const text = String(value);
  return ID_KEY.test(key) ? truncate(text, 32) : truncate(text, 48);
}

function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function pickRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const keys = ["data", "rows", "items", "orders", "agents", "clients", "products", "records", "list", "result"];
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
    if (value && typeof value === "object") {
      const nested = pickRows(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function rowTotal(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const obj = payload as Record<string, unknown>;
  const n = Number(obj.total ?? obj.count);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function chooseColumns(rows: Array<Record<string, unknown>>, preferred: string[]): string[] {
  const first = rows[0] ?? {};
  const available = Object.keys(first).filter((key) => !isSecretKey(key) && isPrimitive(first[key]));
  const picked = preferred.filter((key) => available.includes(key));
  const extra = available.filter((key) => !picked.includes(key) && !key.startsWith("_"));
  const result = [...picked, ...extra].slice(0, 6);
  return result.length ? result : available.slice(0, 4);
}

export type GenericTableOptions = {
  title: string;
  summary?: string;
  preferred?: string[];
  maxRows?: number;
  source?: string;
};

/** Universal jadval: har qanday `{data: [...]}` javobi uchun. */
export function genericTable(payload: unknown, opts: GenericTableOptions): AiTableResult {
  const rows = pickRows(payload);
  const maxRows = Math.max(1, opts.maxRows ?? 50);
  const total = rowTotal(payload);
  if (!rows.length) {
    return { title: opts.title, summary: opts.summary ?? "Yozuv topilmadi", columns: [], rows: [], source: opts.source };
  }
  const columns = chooseColumns(rows, opts.preferred ?? []);
  const shown = rows.slice(0, maxRows);
  const summary = opts.summary ?? `${total ?? rows.length} ta yozuv`;
  return {
    title: opts.title,
    summary,
    columns: columns.map(columnLabel),
    rows: shown.map((row) => columns.map((key) => cell(key, row[key]))),
    source: opts.source,
    truncated: rows.length > shown.length
  };
}

/** Kalit-qiymat ko‘rinishidagi obyekt → metrikalar jadvali. */
export function metricsTable(
  payload: unknown,
  opts: { title: string; keys: Array<{ key: string; label: string; money?: boolean }>; summary?: string; source?: string }
): AiTableResult {
  const obj = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const rows = opts.keys
    .filter((item) => obj[item.key] !== undefined)
    .map((item) => [item.label, item.money ? money(obj[item.key], "") : cell(item.key, obj[item.key])] as string[]);
  return {
    title: opts.title,
    summary: opts.summary ?? "",
    columns: ["Ko‘rsatkich", "Qiymat"],
    rows,
    source: opts.source
  };
}

export type TableInput = {
  title: string;
  summary: string;
  /** Ustun kalitlari (formatlash uchun: summa, sana va h.k.). */
  keys: string[];
  /** Ko‘rsatiladigan ustun sarlavhalari. */
  columns?: string[];
  rows: unknown[][];
  maxRows?: number;
  source?: string;
};

/** Tayyor qatorlarni xavfsiz jadvalga aylantiradi (limit + format + redaction). */
export function table(input: TableInput): AiTableResult {
  const maxRows = Math.max(1, input.maxRows ?? 50);
  const shown = input.rows.slice(0, maxRows);
  return {
    title: input.title,
    summary: input.summary,
    columns: input.columns ?? input.keys.map(columnLabel),
    rows: shown.map((row) => row.map((value, index) => cell(input.keys[index] ?? "", value))),
    source: input.source,
    truncated: input.rows.length > shown.length
  };
}

/** Erkin matnli jadval (qiymatlar allaqachon formatlangan). */
export function rawTable(input: {
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  maxRows?: number;
  source?: string;
}): AiTableResult {
  const maxRows = Math.max(1, input.maxRows ?? 50);
  return {
    title: input.title,
    summary: input.summary,
    columns: input.columns,
    rows: input.rows.slice(0, maxRows),
    source: input.source,
    truncated: input.rows.length > maxRows
  };
}

/** Satrlardan `{jadval matni}` — eksport uchun. */
export function mergeTables(tables: AiTableResult[]): { columns: string[]; rows: string[][] } {
  const columns: string[] = [];
  for (const item of tables) {
    for (const column of item.columns) {
      if (!columns.includes(column)) columns.push(column);
    }
  }
  const rows: string[][] = [];
  for (const item of tables) {
    for (const row of item.rows) {
      const mapped = columns.map((column) => {
        const index = item.columns.indexOf(column);
        return index >= 0 ? row[index] ?? "" : "";
      });
      rows.push(mapped);
    }
  }
  return { columns, rows };
}
