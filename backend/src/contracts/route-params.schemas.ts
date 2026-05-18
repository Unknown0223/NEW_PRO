import { z } from "zod";

/** Ko‘p marshrutlardagi `/.../:id` musbat butun son identifikatori */
export const positiveIntPathIdParamsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => Number.parseInt(s, 10))
});
