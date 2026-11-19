/** SalesDoc `/report/price` — По ценам / История изменения цен (flat). */

export type PricesReportFilters = {
  from: string;
  to: string;
  price_types: string[];
  category_ids: number[];
  brand_ids: number[];
  product_ids: number[];
  search?: string;
  page: number;
  limit: number;
};

export type PricesReportRow = {
  row_number: number;
  changed_at: string;
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string;
  brand_name: string;
  price_type: string;
  price_type_label: string;
  price: string;
  currency: string;
  previous_price: string | null;
  diff: string | null;
};

export type PricesReportTotals = {
  change_count: number;
  product_count: number;
};
