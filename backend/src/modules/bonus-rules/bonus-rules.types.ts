export type BonusConditionRow = {
  id: number;
  min_qty: number | null;
  max_qty: number | null;
  step_qty: number;
  bonus_qty: number;
  max_bonus_qty: number | null;
  sort_order: number;
};

export type BonusRuleRow = {
  id: number;
  tenant_id: number;
  name: string;
  type: string;
  buy_qty: number | null;
  free_qty: number | null;
  min_sum: number | null;
  /** `order` | `calendar_month` — `sum` (min sum) va `qty` (shartdagi miqdor) uchun */
  sum_threshold_scope: string;
  discount_pct: number | null;
  priority: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  client_category: string | null;
  payment_type: string | null;
  client_type: string | null;
  sales_channel: string | null;
  price_type: string | null;
  product_ids: number[];
  bonus_product_ids: number[];
  product_category_ids: number[];
  target_all_clients: boolean;
  selected_client_ids: number[];
  is_manual: boolean;
  in_blocks: boolean;
  once_per_client: boolean;
  one_plus_one_gift: boolean;
  prerequisite_rule_ids: number[];
  /** Bo‘sh = cheklov yo‘q. `User.branch` bilan mos (case-insensitive). */
  scope_branch_codes: string[];
  /** Bo‘sh = cheklov yo‘q. Zakaz agenti ID; filial bilan birga — OR. */
  scope_agent_user_ids: number[];
  /** Bo‘sh = cheklov yo‘q. `User.trade_direction_id`. */
  scope_trade_direction_ids: number[];
  /** Ro‘yxat API: bog‘langan qoidalar shartining qisqa matni (nomisiz), `prerequisite_rule_ids` tartibi bilan. */
  prerequisite_summaries?: string[];
  conditions: BonusConditionRow[];
};

export type BonusConditionInput = {
  min_qty?: number | null;
  max_qty?: number | null;
  step_qty: number;
  bonus_qty: number;
  max_bonus_qty?: number | null;
  sort_order?: number;
};

export type CreateBonusRuleInput = {
  name: string;
  type: string;
  buy_qty?: number | null;
  free_qty?: number | null;
  min_sum?: number | null;
  sum_threshold_scope?: "order" | "calendar_month";
  discount_pct?: number | null;
  priority?: number;
  is_active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  client_category?: string | null;
  payment_type?: string | null;
  client_type?: string | null;
  sales_channel?: string | null;
  price_type?: string | null;
  product_ids?: number[];
  bonus_product_ids?: number[];
  product_category_ids?: number[];
  target_all_clients?: boolean;
  selected_client_ids?: number[];
  is_manual?: boolean;
  in_blocks?: boolean;
  once_per_client?: boolean;
  one_plus_one_gift?: boolean;
  prerequisite_rule_ids?: number[];
  scope_branch_codes?: string[];
  scope_agent_user_ids?: number[];
  scope_trade_direction_ids?: number[];
  conditions?: BonusConditionInput[];
};

export type UpdateBonusRuleInput = Partial<CreateBonusRuleInput>;

export const bonusRuleInclude = {
  conditions: {
    orderBy: { sort_order: "asc" as const }
  }
} as const;
