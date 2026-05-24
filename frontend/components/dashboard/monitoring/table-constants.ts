import type { ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";

export const MON_BRANCH_TABLE_ID = "dashboard-sales-monitoring/branch-performance";
export const MON_SUP_TABLE_ID = "dashboard-sales-monitoring/supervisor-performance";
export const MON_SKU_TABLE_ID = "dashboard-sales-monitoring/sku-matrix";

export const MON_BRANCH_COLS: ColumnDefItem[] = [
  { id: "rank", label: "#" },
  { id: "branch", label: "Филиал" },
  { id: "akb", label: "АКБ" },
  { id: "okb", label: "ОКБ" },
  { id: "coverage_pct", label: "Покрытие" },
  { id: "plan_sales", label: "План" },
  { id: "fact_sales", label: "Факт" },
  { id: "execution_pct", label: "Выполнение" }
];
export const MON_BRANCH_DEFAULT_ORDER = MON_BRANCH_COLS.map((c) => c.id);

export const MON_SUP_COLS: ColumnDefItem[] = [
  { id: "rank", label: "#" },
  { id: "supervisor_name", label: "Супервайзер" },
  { id: "akb", label: "АКБ" },
  { id: "orders_count", label: "Заказы" },
  { id: "plan_sales", label: "План" },
  { id: "fact_sales", label: "Факт" },
  { id: "plan_fact_gap", label: "Разрыв" },
  { id: "execution_pct", label: "%" }
];
export const MON_SUP_DEFAULT_ORDER = MON_SUP_COLS.map((c) => c.id);

export const MON_SKU_COLS: ColumnDefItem[] = [
  { id: "name", label: "Товар" },
  { id: "sku", label: "SKU" },
  { id: "total_qty", label: "Кол-во" },
  { id: "total_sum", label: "Всего" },
  { id: "return_pct", label: "Возв. %" },
  { id: "cancel_pct", label: "Отм. %" },
  { id: "sum_new", label: "Новый" },
  { id: "sum_cancelled", label: "Отменён" },
  { id: "sum_confirmed", label: "Подтв." },
  { id: "sum_shipped", label: "Отгр." },
  { id: "sum_delivered", label: "Достав." },
  { id: "sum_returned", label: "Возврат" }
];
export const MON_SKU_DEFAULT_ORDER = MON_SKU_COLS.map((c) => c.id);

export const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;
