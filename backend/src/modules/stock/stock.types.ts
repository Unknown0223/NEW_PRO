/**
 * Stock DTO va umumiy turlar.
 */
export type StockRow = {
  id: number;
  warehouse_id: number;
  warehouse_name: string;
  product_id: number;
  sku: string;
  product_name: string;
  qty: string;
  reserved_qty: string;
};

export const WAREHOUSE_STOCK_PURPOSES = ["sales", "return", "reserve"] as const;
export type WarehouseStockPurpose = (typeof WAREHOUSE_STOCK_PURPOSES)[number];

export type StockBalanceSummaryRow = {
  product_id: number;
  sku: string;
  name: string;
  qty: string;
  reserved_qty: string;
  available_qty: string;
};

export type StockBalanceValuationRow = StockBalanceSummaryRow & {
  amount_actual: string;
  amount_reserved: string;
  amount_available: string;
  currency: string;
};

export type StockBalanceByWhRow = {
  warehouse_id: number;
  warehouse_name: string;
  category_id: number | null;
  category_name: string | null;
  product_id: number;
  sku: string;
  name: string;
  qty: string;
  reserved_qty: string;
  available_qty: string;
};

export type StockBalanceTotals = {
  qty: string;
  reserved_qty: string;
  available_qty: string;
  amount_actual?: string;
  amount_reserved?: string;
  amount_available?: string;
  currency?: string;
};

export type StockBalanceQtyMode = "all" | "positive" | "zero";
