export type Visits2Filters = {
  from: string;
  to: string;
  agent_ids?: number[];
  client_categories?: string[];
  /** Hafta kuni 1..7 (JSON bilan mos), bir nechta */
  weekdays?: number[];
  product_category_refs?: string[];
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  search?: string;
  page: number;
  limit: number;
  sort_by: "client_name" | "client_id" | "last_visit" | "agent_name" | "territory";
  sort_dir: "asc" | "desc";
};

export type Visits2Row = {
  row_number: number;
  client_id: number;
  client_name: string;
  client_phone: string | null;
  agent_name: string;
  visit_day_label: string;
  last_visit_at: string | null;
  territory: string;
};

export type Visits2ReportPayload = {
  period_from: string;
  period_to: string;
  page: number;
  limit: number;
  total: number;
  rows: Visits2Row[];
};
