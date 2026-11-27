/** ADR-010 FlatReport config — M1 kinds: dateRange | search | multiSelect | select | bands */

import type { ReactNode } from "react";

export type FlatReportDateRangeField = {
  kind: "dateRange";
  /** Query param for start; default `from`. */
  fromKey?: string;
  /** Query param for end; default `to`. */
  toKey?: string;
  /** Optional label before the picker (e.g. dual period A/B). */
  label?: string;
  /** Draft seed: current month (default), previous month, or today (same from/to). */
  defaultRange?: "month" | "prev_month" | "today";
};

export type FlatReportSearchField = {
  kind: "search";
  /** Query param key; default `search`. */
  paramKey?: string;
  placeholder: string;
};

export type FlatReportMultiSelectField = {
  kind: "multiSelect";
  /** Query param key, e.g. `agent_ids`. */
  paramKey: string;
  /** Key on filter-options payload, e.g. `agents` / `territory_1`. */
  optionsFrom: string;
  placeholder: string;
  /** Initial selected ids (e.g. SalesDoc default statuses). */
  defaultValue?: string[];
};

export type FlatReportSelectField = {
  kind: "select";
  paramKey: string;
  /** Key on filter-options payload (array of {id,label} or {id,name}). */
  optionsFrom?: string;
  /** Hardcoded options when filter-options has no list (e.g. client_activity). */
  staticOptions?: Array<{ id: string; label: string }>;
  defaultValue: string;
  /** Ixcham gridda maydon nomi (Год / Месяц) — tanlangan qiymat ustida. */
  placeholder?: string;
};

export type FlatReportBandsField = {
  kind: "bands";
  /** Query param key; default `bands`. */
  paramKey?: string;
  /** Initial value when options not loaded. */
  defaultValue?: string;
  /** filter-options key for default string, e.g. `default_bands`. */
  defaultFromOptionsKey?: string;
  placeholder?: string;
};

export type FlatReportFilterField =
  | FlatReportDateRangeField
  | FlatReportSearchField
  | FlatReportMultiSelectField
  | FlatReportSelectField
  | FlatReportBandsField;

export type FlatReportColumnFormat = "text" | "money" | "orderStatus" | "number";

export type FlatReportColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
  format?: FlatReportColumnFormat;
  /** Extra cell classNames (e.g. muted / emphasis). */
  cellClassName?: string;
  /** Nested / derived cell value (e.g. sku-3 `cells[id].amount`). */
  valueFrom?: (row: Record<string, unknown>) => unknown;
};

export type FlatReportColumnsContext = {
  applied: Record<string, string | number | string[]>;
  filterOptions: Record<string, unknown> | undefined;
  /** Latest report payload (matrix adapters may read `columns`). */
  reportData?: Record<string, unknown> | undefined;
};

export type FlatReportClientTableSearch = {
  /** Row fields matched by client-side filter (case-insensitive). */
  rowKeys: string[];
  placeholder?: string;
};

/**
 * Declarative adapter → FlatReportPage interface.
 * Backend paths stay per-report; this config only drives FE chrome.
 */
export type FlatReportConfig = {
  title: string;
  /** Optional subtitle under title. */
  description?: string;
  apiPath: string;
  exportPermission: string;
  exportFilename: string;
  filterFields: FlatReportFilterField[];
  /** Static columns or dynamic from applied/group_by. */
  columns: FlatReportColumn[] | ((ctx: FlatReportColumnsContext) => FlatReportColumn[]);
  /** Summary chips + footer money columns (order preserved). */
  totalsKeys: string[];
  /** Label per totalsKeys entry (summary chips). */
  totalsLabels?: Record<string, string>;
  /** Row identity field for React keys. */
  rowKey: string;
  defaultLimit?: number;
  exportLimit?: number;
  /** e.g. "Заказов" before total count. */
  countLabel?: string;
  /** Colspan for footer "Итого" label cell. */
  footerLeadColSpan?: number;
  /** Table footer row; default true when totalsKeys non-empty. */
  showTableFooter?: boolean;
  /** Optional client-side row filter (API `search` still separate). */
  clientTableSearch?: FlatReportClientTableSearch;
  /** Optional per-column cell override; wins over `column.format`. May depend on applied filters. */
  formatters?:
    | Record<string, (value: unknown, row: Record<string, unknown>) => ReactNode>
    | ((
        applied: Record<string, string | number | string[]>
      ) => Record<string, (value: unknown, row: Record<string, unknown>) => ReactNode>);
  /** Optional row class (e.g. last_days highlight). */
  rowClassName?: (
    row: Record<string, unknown>,
    applied: Record<string, string | number | string[]>
  ) => string | undefined;
  /** Report payload array key; default `rows` (e.g. client-sales-3 uses `clients`). */
  rowsKey?: string;
  /**
   * Persist column order/visibility via `/me/ui-preferences` (project standard).
   * Default: `report.<apiPath>`.
   */
  tablePrefsId?: string;
  /**
   * Render `date_type` select as radio group next to calendar (client-sales-2 style).
   * Default true when a select field with paramKey `date_type` exists.
   */
  dateTypeAsRadio?: boolean;
  /**
   * Filter grid column count at `xl` breakpoint. Default 9.
   * Use 6 when many filters must fit in exactly two equal rows.
   */
  filterGridCols?: 6 | 9;
  /**
   * Зона → Область → Город: `territory_*` multiSelect options cascade
   * from filter-options maps (`regions_by_zone` / `cities_by_zone_region`).
   */
  territoryCascade?: boolean;
};
