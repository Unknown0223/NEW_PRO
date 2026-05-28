import { z } from "zod";

const scopeFields = {
  scope_agent_user_ids: z.array(z.number().int().positive()).optional(),
  scope_warehouse_ids: z.array(z.number().int().positive()).optional(),
  scope_territory_refs: z.array(z.string()).optional(),
  scope_zones: z.array(z.string()).optional(),
  scope_regions: z.array(z.string()).optional(),
  scope_cities: z.array(z.string()).optional(),
  payment_method_ref: z.string().max(64).nullable().optional(),
  trade_direction_ref: z.string().max(128).nullable().optional(),
  scope_trade_direction_refs: z.array(z.string().max(128)).optional(),
  consignment_mode: z.enum(["all", "yes", "no"]).optional(),
  currency_code: z.string().max(8).optional(),
  amount_from: z.number().nullable().optional(),
  amount_to: z.number().nullable().optional()
};

export const restrictionCreateSchema = z.object({
  name: z.string().min(1).max(256),
  is_active: z.boolean().optional(),
  comment: z.string().max(2000).nullable().optional(),
  ...scopeFields
});

export const restrictionUpdateSchema = restrictionCreateSchema.partial();

export const autoConfirmCreateSchema = restrictionCreateSchema.extend({
  request_type_refs: z.array(z.string()).optional(),
  source_channels: z.array(z.enum(["web", "mobile"])).optional(),
  execution_type: z.enum(["instant", "exact_time", "business_days_n"]).optional(),
  execution_time: z.string().max(16).nullable().optional(),
  n_value: z.number().int().positive().nullable().optional()
});

export const autoConfirmUpdateSchema = autoConfirmCreateSchema.partial();

export const patchFieldSchema = z.object({
  field: z.string().min(1),
  value: z.unknown()
});
