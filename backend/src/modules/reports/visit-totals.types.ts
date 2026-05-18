import { Prisma } from "@prisma/client";
import { ORDER_STATUSES } from "../orders/order-status";

/** Filtr uchun ruxsat etilgan `orders.status` qiymatlari (+ `return_processing`). */
export const VISIT_TOTALS_ORDER_STATUS_IDS = new Set<string>([
  ...ORDER_STATUSES,
  "return_processing"
]);

/** Skrinshot / operator terminologiyasi bilan mos tartib. */
export const VISIT_TOTALS_ORDER_STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "new", label: "Новый" },
  { id: "cancelled", label: "Отменен" },
  { id: "confirmed", label: "Подтвержден к отгрузке" },
  { id: "picking", label: "Комплектация" },
  { id: "delivering", label: "Отгружен" },
  { id: "delivered", label: "Доставлен" },
  { id: "return_processing", label: "В процессе возврата" },
  { id: "returned", label: "Возврат" }
];

export type VisitTotalsFilters = {
  from: string;
  to: string;
  agent_ids: number[];
  /** Bo‘sh — dashboard bilan bir xil: zakazlar `cancelled`/`returned` dan tashqari. */
  order_statuses: string[];
  search?: string;
  page: number;
  limit: number;
};

export const MAX_RANGE_DAYS = 93;
export const EXPORT_CAP = 10_000;

export type DayMetricRow = {
  agent_id: number;
  agent_name: string;
  agent_code: string | null;
  is_active: boolean;
  planned_visits: bigint;
  visited_planned: bigint;
  visited_total: bigint;
  orders_count: bigint;
  sales_sum: Prisma.Decimal;
};

export type VisitTotalsRow = {
  row_number: number;
  work_date: string;
  agent_id: number;
  agent_label: string;
  first_activity_at: string | null;
  last_activity_at: string | null;
  planned: number;
  visited: number;
  not_visited: number;
  orders_count: number;
  sales_sum: string;
  visit_completion_pct: number;
  conversion_orders_per_visit: number;
  avg_order_value: string;
};

export type VisitTotalsPayload = {
  from: string;
  to: string;
  page: number;
  limit: number;
  total: number;
  rows: VisitTotalsRow[];
};
