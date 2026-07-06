import { z } from "zod";
import type { ListStaffFilters } from "./staff.service";

export const agentEntitlementsPayloadSchema = z
  .object({
    price_types: z.array(z.string()).optional(),
    product_rules: z
      .array(
        z.object({
          category_id: z.number().int().positive(),
          all: z.boolean(),
          product_ids: z.array(z.number().int().positive()).optional()
        })
      )
      .optional()
  })
  /** `mobile_config` va boshqa kalitlar (normalize qilish `staff.service` da) */
  .passthrough();

export const agentEntitlementsSchema = agentEntitlementsPayloadSchema.optional();

export const createBodySchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().nullable().optional(),
  middle_name: z.string().nullable().optional(),
  login: z.string().min(1),
  password: z.string().min(6),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  agent_type: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  pinfl: z.string().nullable().optional(),
  consignment: z.boolean().optional(),
  consignment_limit_amount: z.union([z.string(), z.null()]).optional(),
  consignment_ignore_previous_months_debt: z.boolean().optional(),
  consignment_close_day: z.number().int().min(1).max(31).optional(),
  consignment_close_hour: z.number().int().min(0).max(23).optional(),
  consignment_close_minute: z.number().int().min(0).max(59).optional(),
  apk_version: z.string().nullable().optional(),
  device_name: z.string().nullable().optional(),
  can_authorize: z.boolean().optional(),
  price_type: z.string().nullable().optional(),
  agent_price_types: z.array(z.string()).optional(),
  agent_entitlements: agentEntitlementsSchema,
  warehouse_id: z.number().int().positive().nullable().optional(),
  return_warehouse_id: z.number().int().positive().nullable().optional(),
  trade_direction_id: z.number().int().positive().nullable().optional(),
  trade_direction: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  app_access: z.boolean().optional(),
  territory: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  max_sessions: z.number().int().min(1).max(99).optional(),
  kpi_color: z.string().max(16).nullable().optional(),
  work_slot_id: z.number().int().positive().nullable().optional()
});

export const patchStaffMutableBody = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().nullable().optional(),
  middle_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  agent_type: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  pinfl: z.string().nullable().optional(),
  consignment: z.boolean().optional(),
  consignment_limit_amount: z.union([z.string(), z.null()]).optional(),
  consignment_ignore_previous_months_debt: z.boolean().optional(),
  consignment_close_day: z.number().int().min(1).max(31).optional(),
  consignment_close_hour: z.number().int().min(0).max(23).optional(),
  consignment_close_minute: z.number().int().min(0).max(59).optional(),
  apk_version: z.string().nullable().optional(),
  device_name: z.string().nullable().optional(),
  can_authorize: z.boolean().optional(),
  price_type: z.string().nullable().optional(),
  agent_price_types: z.array(z.string()).optional(),
  warehouse_id: z.number().int().positive().nullable().optional(),
  return_warehouse_id: z.number().int().positive().nullable().optional(),
  trade_direction_id: z.number().int().positive().nullable().optional(),
  trade_direction: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  app_access: z.boolean().optional(),
  territory: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(6).optional(),
  max_sessions: z.number().int().min(1).max(99).optional(),
  kpi_color: z.string().max(16).nullable().optional()
});

export const expeditorAssignmentRulesSchema = z.object({
  price_types: z.array(z.string()).optional(),
  agent_ids: z.array(z.number().int().positive()).optional(),
  warehouse_ids: z.array(z.number().int().positive()).optional(),
  trade_directions: z.array(z.string()).optional(),
  territories: z.array(z.string()).optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).optional()
});

export const patchExpeditorBody = patchStaffMutableBody
  .extend({
    expeditor_assignment_rules: expeditorAssignmentRulesSchema.optional(),
    agent_entitlements: agentEntitlementsSchema
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const patchSupervisorBody = patchStaffMutableBody
  .extend({
    supervisee_agent_ids: z.array(z.number().int().positive()).optional(),
    agent_entitlements: agentEntitlementsSchema
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const patchCollectorBody = patchStaffMutableBody
  .extend({
    agent_entitlements: agentEntitlementsSchema
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const patchAuditorBody = patchStaffMutableBody
  .extend({
    agent_entitlements: agentEntitlementsSchema
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const patchAgentBody = patchStaffMutableBody
  .extend({
    supervisor_user_id: z.number().int().positive().nullable().optional(),
    agent_entitlements: agentEntitlementsSchema
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const bulkAgentIds = z.array(z.number().int().positive()).min(1).max(500);

export const bulkAgentsBody = z.union([
  z.object({
    action: z.literal("set_agent_entitlements"),
    agent_ids: bulkAgentIds,
    agent_entitlements: agentEntitlementsPayloadSchema
  }),
  z
    .object({
      action: z.literal("patch_product_list"),
      agent_ids: bulkAgentIds,
      mode: z.enum(["add", "remove"]),
      category_id: z.number().int().positive().optional(),
      product_ids: z.array(z.number().int().positive()).optional(),
      price_types: z.array(z.string()).optional()
    })
    .refine(
      (o) =>
        (o.product_ids?.length ?? 0) > 0 ||
        (o.price_types?.some((s) => String(s).trim().length > 0) ?? false),
      { message: "empty_product_patch", path: ["product_ids"] }
    )
    .refine((o) => !(o.product_ids?.length) || o.category_id != null, {
      message: "category_required",
      path: ["category_id"]
    }),
  z.object({
    action: z.literal("set_trade_direction"),
    agent_ids: bulkAgentIds,
    trade_direction_id: z.number().int().positive().nullable()
  }),
  z.object({
    action: z.literal("set_trade_directions"),
    updates: z
      .array(
        z.object({
          agent_id: z.number().int().positive(),
          trade_direction_id: z.number().int().positive().nullable()
        })
      )
      .min(1)
      .max(500)
  }),
  z.object({
    action: z.literal("set_consignment"),
    agent_ids: bulkAgentIds,
    consignment: z.boolean()
  }),
  z.object({
    action: z.literal("set_consignment_close"),
    agent_ids: bulkAgentIds,
    close_day: z.number().int().min(1).max(31),
    close_hour: z.number().int().min(0).max(23),
    close_minute: z.number().int().min(0).max(59)
  }),
  z.object({
    action: z.literal("set_app_access"),
    agent_ids: bulkAgentIds,
    app_access: z.boolean()
  }),
  z.object({
    action: z.literal("revoke_sessions"),
    agent_ids: bulkAgentIds
  }),
  z.object({
    action: z.literal("set_max_sessions"),
    agent_ids: bulkAgentIds,
    max_sessions: z.number().int().min(1).max(99)
  }),
  z.object({
    action: z.literal("adjust_max_sessions"),
    agent_ids: bulkAgentIds,
    delta: z.number().int().min(-98).max(98).refine((d) => d !== 0, { message: "nonzero" })
  }),
  z.object({
    action: z.literal("patch_mobile_config"),
    agent_ids: bulkAgentIds,
    mobile_config: z
      .object({
        schema_version: z.union([z.literal(1), z.literal("1")]).optional()
      })
      .passthrough()
      .refine((o) => Object.keys(o).length > 0, { message: "empty_mobile_config_patch" })
  })
]);

export const revokeSessionsBody = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ token_ids: z.array(z.number().int().positive()).min(1) })
]);
