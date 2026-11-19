/** SalesDoc `/report/analyze` — Сравнительный анализ продаж (flat, 2 periods). */

export type SalesCompareGroupBy = "product" | "agent" | "client";

export type SalesCompareReportFilters = {
  from_a: string;
  to_a: string;
  from_b: string;
  to_b: string;
  group_by: SalesCompareGroupBy;
  agent_ids: number[];
  category_ids: number[];
  search?: string;
  page: number;
  limit: number;
};

export type SalesCompareReportRow = {
  row_number: number;
  group_key: string;
  name: string;
  sum_a: string;
  sum_b: string;
  diff_sum: string;
  diff_pct: string | null;
  orders_a: number;
  orders_b: number;
  akb_a: number;
  akb_b: number;
  avg_a: string;
  avg_b: string;
};