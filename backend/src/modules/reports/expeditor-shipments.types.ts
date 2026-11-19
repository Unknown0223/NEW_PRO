export type ExpeditorShipmentsDateType = "order_date" | "shipped_date" | "delivered_date";

export type ExpeditorShipmentsFilters = {
  date_type: ExpeditorShipmentsDateType;
  from: string;
  to: string;
  expeditor_ids?: number[];
  category_ids?: number[];
  product_ids?: number[];
  statuses?: string[];
  search?: string;
  page: number;
  limit: number;
};

export type ExpeditorShipmentsCol = {
  expeditor_id: number | null;
  expeditor_name: string;
};

export type ExpeditorShipmentsCell = {
  block_count: number;
  volume: string;
  qty: string;
  amount: string;
};

export type ExpeditorShipmentsRow = {
  row_number: number;
  product_id: number;
  product_name: string;
  category_name: string;
  cells: Record<string, ExpeditorShipmentsCell>;
};
