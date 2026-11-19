export type P1Metric = {
  akb: number;
  qty: string;
  total: string;
};

export type P1MonthCol = {
  key: string;
  year: number;
  month: number;
  label: string;
  kind: "month" | "quarter" | "year";
};

export type P1RowKind = "grand_total" | "region" | "product";

export type P1Row = {
  kind: P1RowKind;
  region_key: string;
  region_label: string;
  product_id: number | null;
  product_name: string | null;
  /** monthKey → metrics (joriy yil + compare yil) */
  cells: Record<string, P1Metric>;
  /** joriy vs compare: (cy/ly - 1), faqat oy/chorak/yil juftlari */
  yoy: Record<string, { akb: number | null; qty: number | null; total: number | null }>;
};

export type P1DateType = "order_date" | "shipped_date" | "delivered_date";

export type P1ReportFilters = {
  year: number;
  /** YoY uchun; default year-1 */
  compare_year: number;
  date_type: P1DateType;
  trade_direction_ids: number[];
  product_ids: number[];
  brand_ids: number[];
  territory_1_list: string[];
  territory_2_list: string[];
  search?: string;
};

export type P1ReportPayload = {
  year: number;
  compare_year: number;
  date_type: P1DateType;
  months: P1MonthCol[];
  rows: P1Row[];
  totals_note: string;
};

export type P1AggCellRaw = {
  year: number;
  month: number;
  region_key: string;
  product_id: number;
  product_name: string;
  akb: bigint;
  qty: { toString(): string } | string;
  total: { toString(): string } | string;
};
