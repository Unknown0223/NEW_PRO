import { z } from "zod";

export const planningCenterQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  direction_id: z.coerce.number().int().positive()
});

const decimalField = z.union([z.string(), z.number()]).optional();
const intField = z.coerce.number().int().min(0).optional();

export const patchPlanTargetBodySchema = z
  .object({
    cost: decimalField,
    count: decimalField,
    volume: decimalField,
    acb: decimalField,
    order_count: intField,
    comment: z.string().max(2000).nullable().optional(),
    status: z
      .enum(["draft", "in_progress", "pending_approval", "approved", "rejected", "archived"])
      .optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "EMPTY_PATCH" });

export const bulkSaveTargetsBodySchema = z
  .object({
    targets: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            cost: decimalField,
            count: decimalField,
            volume: decimalField,
            acb: decimalField,
            order_count: intField,
            comment: z.string().max(2000).nullable().optional(),
            status: z
              .enum(["draft", "in_progress", "pending_approval", "approved", "rejected", "archived"])
              .optional()
          })
          .strict()
      )
      .max(5000)
  })
  .strict();

export const confirmPlansBodySchema = z
  .object({
    plan_ids: z.array(z.number().int().positive()).max(200).optional()
  })
  .strict();

export type PlanningCenterQuery = z.infer<typeof planningCenterQuerySchema>;
export type PatchPlanTargetBody = z.infer<typeof patchPlanTargetBodySchema>;
export type BulkSaveTargetsBody = z.infer<typeof bulkSaveTargetsBodySchema>;
