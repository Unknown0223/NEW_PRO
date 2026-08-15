export type ListCatalogOpts = {
  search?: string;
  /** Explicit filter; default list = active only unless include_inactive. */
  is_active?: boolean | null;
  /** true → is_active filtr yo‘q (aktiv + noaktiv). */
  include_inactive?: boolean;
  page: number;
  limit: number;
};

export type InterchangeableGroupRow = {
  id: number;
  name: string;
  code: string | null;
  sort_order: number | null;
  comment: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  products: { id: number; sku: string; name: string }[];
  price_types: string[];
};

export type InterchangeableExchangeLookupRow = {
  group_id: number;
  group_name: string;
  price_types: string[];
  products: { id: number; sku: string; name: string }[];
};
