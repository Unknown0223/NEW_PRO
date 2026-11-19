export type OrderQtyFilters = {
  from: string;
  to: string;
  agent_ids?: number[];
  category_ids?: number[];
  client_categories?: string[];
  statuses?: string[];
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  search?: string;
  page: number;
  limit: number;
};

export type OrderQtyRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  phone: string;
  agent_name: string;
  order_count: number;
  return_count: number;
  exchange_count: number;
};
