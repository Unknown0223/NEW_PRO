export type ClientSales4Filters = {
  from: string;
  to: string;
  statuses?: string[];
  order_types?: string[];
  agent_ids?: number[];
  category_ids?: number[];
  client_categories?: string[];
  trade_direction_ids?: number[];
  brand_ids?: number[];
  consignment: "all" | "yes" | "no";
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  search?: string;
  only_with_value: boolean;
  page: number;
  limit: number;
};

export type ReportActor = {
  userId: number | null;
  role: string;
  supervisor_user_id?: number | null;
  trade_direction_ids?: number[];
};
