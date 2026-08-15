export type BonusStrategyMemberRow = {
  bonus_rule_id: number;
  sort_order: number;
  rule_name?: string;
  rule_type?: string;
  rule_is_active?: boolean;
};

export type BonusStrategyRow = {
  id: number;
  name: string;
  is_active: boolean;
  max_select: number;
  scope_branch_codes: string[];
  scope_agent_user_ids: number[];
  scope_trade_direction_ids: number[];
  created_at?: string;
  updated_at?: string;
  members: BonusStrategyMemberRow[];
};

export type BonusRuleLite = {
  id: number;
  name: string;
  type: string;
  is_active: boolean;
  discount_pct?: number | null;
};
