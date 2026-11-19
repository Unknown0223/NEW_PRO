export type Sku3Filters = {
  from: string;
  to: string;
  agent_ids?: number[];
  expeditor_ids?: number[];
  product_ids: number[];
  price_types?: string[];
  client_categories?: string[];
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  search?: string;
  page: number;
  limit: number;
};

export type Sku3ProductCol = {
  product_id: number;
  product_name: string;
  sku: string;
};

export type Sku3Cell = {
  amount: string;
  qty: string;
};

export type Sku3Row = {
  row_number: number;
  client_id: number;
  client_name: string;
  cells: Record<string, Sku3Cell>;
};
