/** SalesDoc `/clients/Inventorization` — mijoz inventari + davr savdosi. */

export type InventoryDateType = "order_date" | "shipped_date";
export type InventoryClientActive = "all" | "active" | "inactive";

export type InventoryFilters = {
  date_type: InventoryDateType;
  from: string;
  to: string;
  inventory_types: string[];
  agent_ids: number[];
  supervisor_ids: number[];
  category_ids: number[];
  statuses: string[];
  payment_methods: string[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  client_active: InventoryClientActive;
  search?: string;
  page: number;
  limit: number;
};

export type InventoryRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  phone: string;
  address: string;
  city: string;
  agent_name: string;
  supervisor_name: string;
  inventory_types: string;
  equipment_count: number;
  order_count: number;
  qty: string;
  amount: string;
};
