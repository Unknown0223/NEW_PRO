/** SalesDoc `/report/bonusAccumulation` — Накопительный бонус (flat agg). */

export type CumulativeBonusDateType = "created_at" | "shipped_date";
export type CumulativeBonusGroupBy = "client" | "agent" | "rule";

export type CumulativeBonusFilters = {
  from: string;
  to: string;
  date_type: CumulativeBonusDateType;
  group_by: CumulativeBonusGroupBy;
  statuses: string[];
  agent_ids: number[];
  bonus_rule_ids: number[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  search?: string;
  page: number;
  limit: number;
};

export type CumulativeBonusRow = {
  row_number: number;
  group_key: string;
  name: string;
  agent_name: string;
  client_name: string;
  rule_name: string;
  purchase_sum: string;
  bonus_qty: string;
  bonus_sum: string;
  order_count: number;
  akb: number;
  rules_count: number;
};
