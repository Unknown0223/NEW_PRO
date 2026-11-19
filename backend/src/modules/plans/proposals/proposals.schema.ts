import { z } from "zod";

export const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

export const contextQuerySchema = z.object({
  direction_id: z.coerce.number().int().positive(),
  target_year: z.coerce.number().int().min(2000).max(2100),
  target_month: z.coerce.number().int().min(1).max(12),
  source_year: z.coerce.number().int().min(2000).max(2100).optional(),
  source_month: z.coerce.number().int().min(1).max(12).optional()
});

const formulaSchema = z.object({
  basis: z.enum(["fact", "previous_plan"]),
  mode: z.enum(["percent", "amount"]),
  value: z.number().finite()
});

export const proposalConfigSchema = z
  .object({
    defaultFormula: formulaSchema,
    rules: z.array(z.record(z.unknown())).default([]),
    cellFormulas: z.record(formulaSchema).optional(),
    overrides: z
      .record(
        z.object({
          value: z.string(),
          reason: z.string()
        })
      )
      .default({}),
    excluded: z.array(z.string()).default([]),
    settings: z
      .object({
        sourceStatus: z.enum(["approved_only", "official"]).default("approved_only"),
        projection: z
          .object({
            enabled: z.boolean(),
            elapsedWorkingDays: z.number(),
            totalWorkingDays: z.number()
          })
          .optional(),
        roundingStep: z.string().default("100000"),
        growthWarningPercent: z.number().default(50),
        outlierLookbackMonths: z.number().int().default(3)
      })
      .passthrough()
  })
  .passthrough();

export const calculateBodySchema = z.object({
  direction_id: z.number().int().positive(),
  target: periodSchema,
  source: periodSchema,
  configs: z.record(proposalConfigSchema),
  kpi_group_ids: z.array(z.number().int().positive()).optional()
});

export const saveProposalBodySchema = z.object({
  direction_id: z.number().int().positive(),
  target: periodSchema,
  source: periodSchema,
  configs: z.record(proposalConfigSchema),
  name: z.string().max(160).optional(),
  idempotency_key: z.string().max(64).optional(),
  rows: z
    .array(
      z.object({
        user_id: z.number().int().positive(),
        work_slot_id: z.number().int().positive().nullable().optional(),
        kpi_group_id: z.number().int().positive(),
        source_fact: z.string().nullable().optional(),
        source_plan: z.string().nullable().optional(),
        base_value: z.string().nullable().optional(),
        proposed_value: z.string().nullable().optional(),
        manual_value: z.string().nullable().optional(),
        manual_reason: z.string().nullable().optional(),
        excluded: z.boolean().optional(),
        ready: z.boolean().optional(),
        issues: z.unknown().optional(),
        resolved_rule: z.unknown().optional()
      })
    )
    .optional()
});

export const patchProposalBodySchema = z.object({
  version: z.number().int().positive(),
  source: periodSchema.optional(),
  configs: z.record(proposalConfigSchema).optional(),
  name: z.string().max(160).nullable().optional(),
  status: z.enum(["draft", "ready", "archived"]).optional(),
  rows: saveProposalBodySchema.shape.rows
});

export const applyProposalBodySchema = z.object({
  version: z.number().int().positive(),
  idempotency_key: z.string().max(64).optional(),
  row_ids: z.array(z.number().int().positive()).optional()
});

export type ContextQuery = z.infer<typeof contextQuerySchema>;
export type CalculateBody = z.infer<typeof calculateBodySchema>;
export type SaveProposalBody = z.infer<typeof saveProposalBodySchema>;
export type PatchProposalBody = z.infer<typeof patchProposalBodySchema>;
export type ApplyProposalBody = z.infer<typeof applyProposalBodySchema>;
