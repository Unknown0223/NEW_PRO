/** SalesDoc `/report/bonusReport` — По бонусам (flat agg, not category matrix). */

export type BonusesDateType = "created_at" | "shipped_date";
export type BonusesGroupBy = "product" | "agent" | "client" | "category";

export type BonusesReportFilters = {
  from: string;
  to: string;
  date_type: BonusesDateType;
  group_by: BonusesGroupBy;
  statuses: string[];
  agent_ids: number[];
  category_ids: number[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  search?: string;
  page: number;
  limit: number;
};

export type BonusesReportRow = {
  row_number: number;
  group_key: string;
  name: string;
  sku: string;
  category_name: string;
  agent_name: string;
  client_name: string;
  qty: string;
  volume_m3: string;
  akb: number;
  order_count: number;
};
