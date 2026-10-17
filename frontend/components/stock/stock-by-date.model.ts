export type StockByDateWarehouseOpt = { id: number; name: string; stock_purpose: string };
export type StockByDateCategoryOpt = { id: number; name: string };
export type StockByDateProductOpt = { id: number; name: string };
export type StockByDatePriceTypeOpt = string;

export type StockByDateRow = {
  idx: number;
  product_id: number;
  sku: string;
  category_name: string | null;
  product_name: string;
  block_name: string | null;
  qty: string;
  volume: string;
  amount: string;
};

export type StockByDatePayload = {
  data: StockByDateRow[];
  total: number;
  page: number;
  limit: number;
};

export const STOCK_BY_DATE_TABLE_ID = "stock.by_date.v1";

export const STOCK_BY_DATE_COLS = [
  { id: "idx", label: "№" },
  { id: "sku", label: "Код" },
  { id: "category", label: "Категория" },
  { id: "name", label: "Названия" },
  { id: "block", label: "Блок" },
  { id: "qty", label: "Кол-во" },
  { id: "volume", label: "Объем" },
  { id: "amount", label: "Сумма" }
] as const;

export const STOCK_BY_DATE_ORDER = STOCK_BY_DATE_COLS.map((c) => c.id);
export const STOCK_BY_DATE_NUMERIC = new Set<string>(["idx", "qty", "volume", "amount"]);

export function stockByDateColumnLabel(id: string): string {
  return STOCK_BY_DATE_COLS.find((x) => x.id === id)?.label ?? id;
}
