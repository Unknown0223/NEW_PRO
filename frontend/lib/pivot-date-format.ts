import type { FieldFormat, PivotConfig, PivotField } from "@salec/pivot-engine";
import { formatDate } from "@salec/pivot-engine";

export type PivotDateDisplayMode = "by_columns" | "date" | "datetime";

export type PivotDateFormatState = {
  mode: PivotDateDisplayMode;
  /** WDR-style pattern, e.g. `dd.MM.yyyy` or `yyyy MM dd HH:mm:ss` */
  pattern: string;
};

export const DEFAULT_PIVOT_DATE_FORMAT: PivotDateFormatState = {
  mode: "by_columns",
  pattern: "yyyy MM dd"
};

export const DATE_FORMAT_PATTERNS = [
  "yyyy.MM.dd",
  "yyyy MM dd",
  "yyyy/MM/dd",
  "dd.MM.yyyy",
  "dd MM yyyy",
  "dd/MM/yyyy"
] as const;

export const DATETIME_FORMAT_PATTERNS = [
  "yyyy.MM.dd HH:mm:ss",
  "yyyy MM dd HH:mm:ss",
  "yyyy/MM/dd HH:mm:ss",
  "dd.MM.yyyy HH:mm:ss",
  "dd-MM-yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm:ss"
] as const;

/** Full date field → year/month/day parts (report-builder registry). */
const DATE_PARTS: Record<string, [string, string, string]> = {
  order_date: ["order_date_year", "order_date_month", "order_date_day"],
  shipped_date: ["shipped_date_year", "shipped_date_month", "shipped_date_day"],
  delivered_date: ["delivered_date_year", "delivered_date_month", "delivered_date_day"],
  return_date: ["return_date_year", "return_date_month", "return_date_day"],
  client_created_date: ["client_created_year", "client_created_month", "client_created_day"]
};

const PART_TO_PARENT: Record<string, string> = Object.fromEntries(
  Object.entries(DATE_PARTS).flatMap(([parent, parts]) => parts.map((p) => [p, parent]))
);

export function dateFormatStateFromConfig(config: PivotConfig): PivotDateFormatState {
  const mode = config.options.dateDisplayMode ?? DEFAULT_PIVOT_DATE_FORMAT.mode;
  const pattern =
    mode === "datetime"
      ? (config.options.dateTimePattern ?? DATETIME_FORMAT_PATTERNS[1]!)
      : (config.options.datePattern ?? DEFAULT_PIVOT_DATE_FORMAT.pattern);
  return { mode, pattern };
}

function availableIds(fields: PivotField[]): Set<string> {
  return new Set(fields.map((f) => f.id));
}

function expandAxis(ids: string[], avail: Set<string>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const parts = DATE_PARTS[id];
    if (parts && parts.every((p) => avail.has(p))) {
      for (const p of parts) {
        if (!out.includes(p)) out.push(p);
      }
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function collapseAxis(ids: string[], avail: Set<string>): string[] {
  const out: string[] = [];
  const skip = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    if (skip.has(id)) continue;
    const parent = PART_TO_PARENT[id];
    if (parent && avail.has(parent)) {
      const parts = DATE_PARTS[parent]!;
      const slice = ids.slice(i, i + 3);
      if (parts.every((p, idx) => slice[idx] === p)) {
        if (!out.includes(parent)) out.push(parent);
        for (const p of parts) skip.add(p);
        continue;
      }
      // lone part → still collapse parent if all three present later
      if (!out.includes(parent) && parts.every((p) => ids.includes(p))) {
        out.push(parent);
        for (const p of parts) skip.add(p);
        continue;
      }
    }
    out.push(id);
  }
  return out;
}

/** Rewrite rows/columns/reportFilters for date display mode. */
export function applyDateFormatToConfig(
  config: PivotConfig,
  fields: PivotField[],
  state: PivotDateFormatState
): PivotConfig {
  const avail = availableIds(fields);
  const mapAxis =
    state.mode === "by_columns"
      ? (ids: string[]) => expandAxis(ids, avail)
      : (ids: string[]) => collapseAxis(ids, avail);

  return {
    ...config,
    rows: mapAxis(config.rows),
    columns: mapAxis(config.columns),
    reportFilters: mapAxis(config.reportFilters),
    options: {
      ...config.options,
      dateDisplayMode: state.mode,
      datePattern: state.mode === "date" ? state.pattern : config.options.datePattern,
      dateTimePattern: state.mode === "datetime" ? state.pattern : config.options.dateTimePattern
    }
  };
}

function parseDateValue(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Date / datetime rejimida to‘liq sana maydonlarini pattern bo‘yicha matnga aylantiradi
 * (pivot guruhlash String(Date) o‘rniga to‘g‘ri format ko‘rsatsin).
 */
export function applyDateFormatToRows(
  rows: Record<string, unknown>[],
  fields: PivotField[],
  state: PivotDateFormatState
): Record<string, unknown>[] {
  if (state.mode === "by_columns") return rows;

  const dateIds = fields.filter((f) => f.dataType === "date").map((f) => f.id);
  if (dateIds.length === 0) return rows;

  const fmt: FieldFormat = { type: "date", dateFormat: state.pattern };
  return rows.map((row) => {
    let touched = false;
    const next: Record<string, unknown> = { ...row };
    for (const id of dateIds) {
      const d = parseDateValue(row[id]);
      if (!d) continue;
      next[id] = formatDate(d, fmt);
      touched = true;
    }
    return touched ? next : row;
  });
}
