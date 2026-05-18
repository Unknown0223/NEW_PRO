export type DateType = "order_date" | "shipped_date" | "delivered_date" | "created_date";
export type ClientActivity = "all" | "active" | "inactive";
export type ConsignmentMode = "all" | "regular" | "consignment";

export type ClientSales2Filters = {
  date_type: DateType;
  from?: string;
  to?: string;
  statuses?: string[];
  status?: string;
  category_ids?: number[];
  product_ids?: number[];
  product_group_ids?: number[];
  segment_ids?: number[];
  day_visit_iso?: number[];
  agent_ids?: number[];
  agent_id?: number;
  price_types?: string[];
  price_type?: string;
  order_types?: string[];
  order_type?: string;
  consignment_mode?: ConsignmentMode;
  client_categories?: string[];
  client_category?: string;
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  territory_1?: string;
  territory_2?: string;
  territory_3?: string;
  client_activity?: ClientActivity;
  sum_from?: number;
  sum_to?: number;
  search?: string;
  page: number;
  limit: number;
};

export type ReportActor = {
  userId: number | null;
  role: string;
};
