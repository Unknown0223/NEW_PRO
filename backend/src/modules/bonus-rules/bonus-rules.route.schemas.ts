import { z } from "zod";

const bonusTypeSchema = z.enum(["qty", "sum", "discount"]);

const conditionSchema = z.object({
  min_qty: z.number().nonnegative().nullable().optional(),
  max_qty: z.number().nonnegative().nullable().optional(),
  step_qty: z.number().positive(),
  bonus_qty: z.number().nonnegative(),
  max_bonus_qty: z.number().nonnegative().nullable().optional(),
  sort_order: z.number().int().optional()
});

const targetingFields = {
  client_category: z.string().nullable().optional(),
  payment_type: z.string().nullable().optional(),
  client_type: z.string().nullable().optional(),
  sales_channel: z.string().nullable().optional(),
  price_type: z.string().nullable().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
  bonus_product_ids: z.array(z.number().int().positive()).optional(),
  product_category_ids: z.array(z.number().int().positive()).optional(),
  scope_restrict_assortment: z.boolean().optional(),
  scope_restrict_category: z.boolean().optional(),
  target_all_clients: z.boolean().optional(),
  selected_client_ids: z.array(z.number().int().positive()).optional(),
  is_manual: z.boolean().optional(),
  in_blocks: z.boolean().optional(),
  once_per_client: z.boolean().optional(),
  one_plus_one_gift: z.boolean().optional(),
  prerequisite_rule_ids: z.array(z.number().int().positive()).max(200).optional(),
  conditions: z.array(conditionSchema).optional(),
  sum_threshold_scope: z.enum(["order", "calendar_month"]).optional(),
  scope_branch_codes: z.array(z.string().max(500)).max(200).optional(),
  scope_agent_user_ids: z.array(z.number().int().positive()).max(2000).optional(),
  scope_trade_direction_ids: z.array(z.number().int().positive()).max(200).optional()
};

export const createBodySchema = z
  .object({
    name: z.string().min(1),
    type: bonusTypeSchema,
    buy_qty: z.number().int().nonnegative().nullable().optional(),
    free_qty: z.number().int().nonnegative().nullable().optional(),
    min_sum: z.number().nonnegative().nullable().optional(),
    discount_pct: z.number().min(0).max(100).nullable().optional(),
    priority: z.number().int().default(0),
    is_active: z.boolean().optional(),
    valid_from: z.string().nullable().optional(),
    valid_to: z.string().nullable().optional()
  })
  .extend(targetingFields);

export const updateBodySchema = createBodySchema.partial();

export const orderScopeBodySchema = z
  .object({
    scope_branch_codes: z.array(z.string().max(500)).max(200).optional(),
    scope_agent_user_ids: z.array(z.number().int().positive()).max(2000).optional(),
    scope_trade_direction_ids: z.array(z.number().int().positive()).max(200).optional(),
    target_all_clients: z.boolean().optional(),
    selected_client_ids: z.array(z.number().int().positive()).optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: "EmptyBody" });

export const activeBodySchema = z.object({
  is_active: z.boolean()
});

export const previewQtyBodySchema = z.object({
  purchased_qty: z.number().nonnegative()
});
