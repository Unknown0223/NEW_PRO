import type { OrderAutoConfirmRule, OrderRestrictionRule, Prisma, User } from "@prisma/client";

export type ConsignmentMode = "all" | "yes" | "no";
export type AutoConfirmExecutionType = "instant" | "exact_time" | "business_days_n";
export type SourceChannel = "web" | "mobile";

export type RuleScopeInput = {
  scope_agent_user_ids?: number[];
  scope_warehouse_ids?: number[];
  scope_territory_refs?: string[];
  scope_zones?: string[];
  scope_regions?: string[];
  scope_cities?: string[];
  payment_method_ref?: string | null;
  trade_direction_ref?: string | null;
  scope_trade_direction_refs?: string[];
  consignment_mode?: ConsignmentMode;
  currency_code?: string;
  amount_from?: number | null;
  amount_to?: number | null;
};

export type RestrictionRuleInput = RuleScopeInput & {
  name: string;
  is_active?: boolean;
  comment?: string | null;
};

export type AutoConfirmRuleInput = RuleScopeInput & {
  name: string;
  is_active?: boolean;
  comment?: string | null;
  request_type_refs?: string[];
  source_channels?: SourceChannel[];
  execution_type?: AutoConfirmExecutionType;
  execution_time?: string | null;
  n_value?: number | null;
};

export type RestrictionRuleRow = {
  id: number;
  name: string;
  currency_code: string;
  amount_from: number | null;
  amount_to: number | null;
  agent_id: number | null;
  agent_user_ids: number[];
  agent_name: string | null;
  warehouse_ids: number[];
  warehouse_names: string[];
  payment_method_ref: string | null;
  trade_direction_ref: string | null;
  trade_direction_refs: string[];
  territory_refs: string[];
  zones: string[];
  regions: string[];
  cities: string[];
  consignment_mode: ConsignmentMode;
  comment: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type AutoConfirmRuleRow = RestrictionRuleRow & {
  request_type_refs: string[];
  source_channels: SourceChannel[];
  execution_type: AutoConfirmExecutionType;
  execution_time: string | null;
  n_value: number | null;
};

export type OrderRuleContext = {
  tenant_id: number;
  total_sum: number;
  currency_code: string;
  warehouse_id: number | null;
  agent_id: number | null;
  agent_trade_direction: string | null;
  payment_method_ref: string | null;
  request_type_ref: string | null;
  is_consignment: boolean;
  order_type: string;
  creation_channel: SourceChannel;
  client_region: string | null;
  client_city: string | null;
  client_zone: string | null;
  client_territory_refs: string[];
};

export type RestrictionRuleDb = OrderRestrictionRule & {
  created_by: Pick<User, "id" | "name"> | null;
  updated_by: Pick<User, "id" | "name"> | null;
};

export type AutoConfirmRuleDb = OrderAutoConfirmRule & {
  created_by: Pick<User, "id" | "name"> | null;
  updated_by: Pick<User, "id" | "name"> | null;
};

export const restrictionRuleInclude = {
  created_by: { select: { id: true, name: true } },
  updated_by: { select: { id: true, name: true } }
} as const satisfies Prisma.OrderRestrictionRuleInclude;

export const autoConfirmRuleInclude = {
  created_by: { select: { id: true, name: true } },
  updated_by: { select: { id: true, name: true } }
} as const satisfies Prisma.OrderAutoConfirmRuleInclude;
