export type DateType = "order_date" | "shipped_date" | "delivered_date";
export type TerritoryNode = {
  name: string;
  active?: boolean;
  children?: TerritoryNode[];
};

export type AgentOrdersFilters = {
  date_type: DateType;
  from?: string;
  to?: string;
  category_id?: number;
  category_ids?: number[];
  product_id?: number;
  product_ids?: number[];
  trade_direction?: string;
  trade_directions?: string[];
  status?: string;
  statuses?: string[];
  agent_id?: number;
  agent_ids?: number[];
  client_category?: string;
  client_categories?: string[];
  price_type?: string;
  price_types?: string[];
  payment_method?: string;
  payment_methods?: string[];
  order_type?: string;
  order_types?: string[];
  product_group_id?: number;
  product_group_ids?: number[];
  segment_id?: number;
  segment_ids?: number[];
  consignment?: "all" | "yes" | "no";
  territory_1?: string;
  territory_1_list?: string[];
  territory_2?: string;
  territory_2_list?: string[];
  territory_3?: string;
  territory_3_list?: string[];
};

function splitCsvTokens(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function intList(v?: string): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x));
}

function strList(v?: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** GET `/api/:slug/reports/agent-orders` query */
