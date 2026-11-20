import { quickRangeToDates } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import type {
  FlatReportColumn,
  FlatReportColumnFormat,
  FlatReportColumnsContext,
  FlatReportConfig,
  FlatReportDateRangeField,
  FlatReportFilterField
} from "./types";

export type DraftState = Record<string, string | number | string[]>;

export type MultiItem = { id: string; title: string; searchText?: string };

export function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function dateRangeKeys(field: FlatReportDateRangeField): { fromKey: string; toKey: string } {
  return { fromKey: field.fromKey ?? "from", toKey: field.toKey ?? "to" };
}

function todayIso(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seedDateRange(
  field: FlatReportDateRangeField,
  monthFrom: string,
  monthTo: string
): { from: string; to: string } {
  if (field.defaultRange === "prev_month") {
    return quickRangeToDates("prev_month") ?? { from: monthFrom, to: monthTo };
  }
  if (field.defaultRange === "today") {
    const day = todayIso();
    return { from: day, to: day };
  }
  return { from: monthFrom, to: monthTo };
}

/** Resolve report list array (`rows` or config.rowsKey e.g. `clients`). */
export function resolveReportRows(
  data: Record<string, unknown> | undefined,
  rowsKey: string | undefined
): Array<Record<string, unknown>> {
  if (!data) return [];
  const key = rowsKey ?? "rows";
  const raw = data[key];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export function buildEmptyDraft(
  fields: FlatReportFilterField[],
  from: string,
  to: string,
  limit: number
): DraftState {
  const draft: DraftState = { page: 1, limit };
  for (const field of fields) {
    if (field.kind === "dateRange") {
      const { fromKey, toKey } = dateRangeKeys(field);
      const seeded = seedDateRange(field, from, to);
      draft[fromKey] = seeded.from;
      draft[toKey] = seeded.to;
      continue;
    }
    if (field.kind === "search") {
      draft[field.paramKey ?? "search"] = "";
      continue;
    }
    if (field.kind === "multiSelect") {
      draft[field.paramKey] = [] as string[];
      continue;
    }
    if (field.kind === "select") {
      draft[field.paramKey] = field.defaultValue;
      continue;
    }
    // bands
    const bandsKey = field.paramKey ?? "bands";
    draft[bandsKey] = field.defaultValue ?? "";
  }
  return draft;
}

export function resolveCellValue(col: FlatReportColumn, row: Record<string, unknown>): unknown {
  return col.valueFrom ? col.valueFrom(row) : row[col.key];
}

/** Prefer `totals[key]`, else top-level report meta (sku-3 okb/akb). */
export function readReportTotal(
  data: ({ totals?: Record<string, unknown> } & Record<string, unknown>) | undefined,
  key: string
): unknown {
  if (!data) return 0;
  if (data.totals && key in data.totals) return data.totals[key];
  if (key in data) return data[key];
  return 0;
}

/** Apply filter-options defaults (e.g. bands.defaultFromOptionsKey) once options load. */
export function applyOptionsDefaults(
  draft: DraftState,
  fields: FlatReportFilterField[],
  opts: Record<string, unknown> | undefined
): DraftState {
  if (!opts) return draft;
  let next = draft;
  for (const field of fields) {
    if (field.kind !== "bands" || !field.defaultFromOptionsKey) continue;
    const key = field.paramKey ?? "bands";
    if (String(next[key] ?? "") !== "") continue;
    const fromOpts = opts[field.defaultFromOptionsKey];
    if (typeof fromOpts === "string" && fromOpts) {
      next = { ...next, [key]: fromOpts };
    }
  }
  return next;
}

export function appendParams(p: URLSearchParams, state: DraftState) {
  Object.entries(state).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      if (v.length > 0) p.set(k, v.join(","));
      return;
    }
    if (v === "" || v === "all") return;
    p.set(k, String(v));
  });
}

export function mapMultiOptions(raw: unknown): MultiItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { id: item, title: item, searchText: item };
    }
    if (item && typeof item === "object") {
      const row = item as {
        id?: number | string;
        value?: number | string;
        name?: string;
        code?: string;
        label?: string;
      };
      const id =
        row.id != null
          ? String(row.id)
          : row.value != null
            ? String(row.value)
            : String(row.name ?? row.label ?? "");
      const title = String(row.name ?? row.label ?? id);
      const searchText = [title, row.code].filter(Boolean).join(" ");
      return { id, title, searchText };
    }
    return { id: String(item), title: String(item) };
  });
}

export function mapSelectOptions(raw: unknown): Array<{ id: string; label: string }> {
  return mapMultiOptions(raw).map((x) => ({ id: x.id, label: x.title }));
}

export function formatCell(value: unknown, format: FlatReportColumnFormat | undefined): string {
  if (value == null || value === "") return "—";
  if (format === "money") return money(value as string | number);
  if (format === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return String(value);
    return formatNumberGrouped(n, { maxFractionDigits: 2 });
  }
  if (format === "orderStatus") {
    const key = String(value);
    return ORDER_STATUS_LABELS[key] ?? key;
  }
  return String(value);
}

export function resolveColumns(
  columns: FlatReportConfig["columns"],
  ctx: FlatReportColumnsContext
): FlatReportColumn[] {
  return typeof columns === "function" ? columns(ctx) : columns;
}

export function filterRowsByClientSearch(
  rows: Array<Record<string, unknown>>,
  search: string | undefined,
  rowKeys: string[]
): Array<Record<string, unknown>> {
  const q = (search ?? "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    rowKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(q))
  );
}
