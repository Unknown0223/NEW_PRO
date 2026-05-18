export type StockReceiptReportRow = {
  idx: number;
  product_id: number;
  category_name: string | null;
  sku: string;
  product_name: string;
  last_purchase_at: string | null;
  qty: string;
  price: string;
  total: string;
};

export type StockReceiptReportOpts = {
  date_from: string;
  date_to: string;
  warehouse_id?: number;
  category_id?: number;
  supplier_id?: number;
  q: string;
  page: number;
  limit: number;
};

export type StockReceiptDailyRow = {
  day: string;
  docs_count: number;
  lines_count: number;
  qty: string;
  total: string;
};

export type StockReceiptDailyOpts = Omit<StockReceiptReportOpts, "page" | "limit"> & {
  page: number;
  limit: number;
};

export type StockReceiptTimelineOpts = Omit<StockReceiptReportOpts, "category_id" | "supplier_id"> & {
  product_id?: number;
  qty_mode: "all" | "positive" | "zero";
};

export type StockReceiptTimelineColumn = {
  key: string;
  label: string;
  at: string;
  receipt_id: number;
};

export type StockReceiptTimelineRow = {
  product_id: number;
  category_name: string | null;
  product_name: string;
  sku: string;
  total_qty: string;
  values: Record<string, string>;
};
