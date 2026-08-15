import { z } from "zod";

export const bonusStrategyMemberSchema = z.object({
  bonus_rule_id: z.number().int().positive(),
  sort_order: z.number().int().optional()
});

export const createBonusStrategyBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  is_active: z.boolean().optional(),
  max_select: z.number().int().positive().optional(),
  scope_branch_codes: z.array(z.string().max(500)).max(200).optional(),
  scope_agent_user_ids: z.array(z.number().int().positive()).max(2000).optional(),
  scope_trade_direction_ids: z.array(z.number().int().positive()).max(200).optional(),
  members: z.array(bonusStrategyMemberSchema).min(2).max(200)
});

export const updateBonusStrategyBodySchema = createBonusStrategyBodySchema.partial().extend({
  members: z.array(bonusStrategyMemberSchema).min(2).max(200).optional()
});

export const bonusStrategySelectionSchema = z.object({
  strategy_id: z.number().int().positive(),
  rule_ids: z.array(z.number().int().positive()).min(1).max(200)
});
