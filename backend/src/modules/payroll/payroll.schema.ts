/**
 * ЗАРПЛАТА — API zod sxemalari.
 */
import { z } from "zod";
import { PAYROLL_FORMULA_KINDS, PAYROLL_GRID_MODES, PAYROLL_METRIC_KEYS } from "./payroll.types";

export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Oy formati YYYY-MM bo‘lishi kerak");

const metricSchema = z.enum(PAYROLL_METRIC_KEYS);

export const componentSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  kind: z.enum(["allowance", "deduction"]),
  mode: z.enum(["fixed", "percent_base", "percent_gross"]),
  value: z.number().finite()
});

export const gateSchema = z.object({
  metric: metricSchema.or(z.literal("kpi_percent")),
  op: z.enum(["lt", "lte", "gt", "gte", "eq"]),
  value: z.number().finite(),
  effect: z.enum(["zero_variable", "reduce_percent"]),
  reduce_percent: z.number().min(0).max(100).optional(),
  label: z.string().max(200).optional()
});

export const formulaConfigSchema = z.object({
  percent: z.number().finite().optional(),
  percent_metric: metricSchema.optional(),
  rate_per_unit: z.number().finite().optional(),
  unit_metric: metricSchema.optional(),
  bonus_base_metric: metricSchema.optional(),
  bonus_base_is_oklad: z.boolean().optional(),
  attendance_prorate: z.enum(["base", "all", "none"]).optional(),
  absence_penalty_percent: z.number().finite().optional(),
  round_to: z.number().int().positive().optional(),
  min_net: z.number().finite().optional(),
  max_net: z.number().finite().optional()
});

export const formulaCreateBodySchema = z.object({
  name: z.string().min(1).max(300),
  code: z.string().max(32).nullable().optional(),
  kind: z.enum(PAYROLL_FORMULA_KINDS),
  roles: z.array(z.string().min(1).max(64)).default([]),
  kpi_group_id: z.number().int().positive().nullable().optional(),
  base_amount: z.number().finite().min(0).default(0),
  config: formulaConfigSchema.default({}),
  components: z.array(componentSchema).default([]),
  gates: z.array(gateSchema).default([]),
  grid_id: z.number().int().positive().nullable().optional(),
  priority: z.number().int().default(0),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  comment: z.string().max(4000).nullable().optional()
});

export const formulaPatchBodySchema = formulaCreateBodySchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "Bo‘sh so‘rov" });

export const gridStepSchema = z.object({
  month: monthSchema.nullable().optional(),
  from_value: z.number().finite().nullable().optional(),
  to_value: z.number().finite().nullable().optional(),
  coefficient: z.number().finite().default(1),
  amount: z.number().finite().default(0),
  sort_order: z.number().int().default(0)
});

export const gridCreateBodySchema = z.object({
  name: z.string().min(1).max(300),
  code: z.string().max(32).nullable().optional(),
  kpi_group_id: z.number().int().positive().nullable().optional(),
  metric: metricSchema.or(z.literal("kpi_percent")).default("kpi_percent"),
  mode: z.enum(PAYROLL_GRID_MODES).default("coefficient"),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  comment: z.string().max(4000).nullable().optional(),
  steps: z.array(gridStepSchema).default([])
});

export const gridPatchBodySchema = gridCreateBodySchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "Bo‘sh so‘rov" });

export const assignmentsBodySchema = z.object({
  items: z
    .array(
      z.object({
        user_id: z.number().int().positive(),
        formula_id: z.number().int().positive().nullable().optional(),
        base_amount: z.number().finite().min(0).nullable().optional(),
        comment: z.string().max(2000).nullable().optional()
      })
    )
    .min(1)
    .max(1000)
});

export const calcQuerySchema = z.object({
  month: monthSchema,
  role: z.string().max(64).optional(),
  kpi_group_id: z.coerce.number().int().positive().optional(),
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true")
});

export const entryPatchBodySchema = z
  .object({
    manual_net: z.number().finite().min(0).nullable().optional(),
    comment: z.string().max(2000).nullable().optional(),
    adjustments: z
      .array(z.object({ code: z.string().max(64), label: z.string().max(200), amount: z.number().finite() }))
      .optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Bo‘sh so‘rov" });

export const paymentCreateBodySchema = z.object({
  period_id: z.number().int().positive().nullable().optional(),
  month: monthSchema.optional(),
  user_id: z.number().int().positive(),
  amount: z.number().finite().positive(),
  method: z.enum(["cash", "bank", "card", "other"]).default("cash"),
  cash_desk_id: z.number().int().positive().nullable().optional(),
  paid_at: z.string().optional(),
  comment: z.string().max(2000).nullable().optional()
});

export const paymentsQuerySchema = z.object({
  month: monthSchema.optional(),
  user_id: z.coerce.number().int().positive().optional(),
  include_voided: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true")
});
