import { z } from "zod";

/** `?direction_id=` query (majburiy, musbat butun). */
export const directionQuerySchema = z.object({
  direction_id: z.coerce.number().int().positive()
});

/** `?direction_id=` ixtiyoriy (options endpointi uchun). */
export const optionsQuerySchema = z.object({
  direction_id: z.coerce.number().int().positive().optional()
});

const levelSchema = z.number().int().positive().nullable();

export const saveApproverBodySchema = z
  .object({
    rows: z
      .array(
        z.object({
          supervisor_user_id: z.number().int().positive(),
          levels: z.array(levelSchema).max(20)
        })
      )
      .max(1000),
    leaders: z.array(z.number().int().positive()).max(50)
  })
  .strict();

export type SaveApproverBody = z.infer<typeof saveApproverBodySchema>;
