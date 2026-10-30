import { z } from "zod";

const lat = z.number().finite().gte(-90).lte(90);
const lng = z.number().finite().gte(-180).lte(180);
const meters = z.number().finite().gte(0).max(1_000_000);

/** Mobil zakaz: qaysi vizit ichida va qanday GPS bilan urilgani (agent «Начать визит»). */
export const mobileOrderVisitSchema = z.object({
  client_id: z.number().int().positive(),
  started_at: z.string().trim().min(10).max(40),
  latitude: lat,
  longitude: lng,
  accuracy_m: meters.optional().nullable(),
  is_mocked: z.boolean().optional(),
  distance_m: meters.optional().nullable(),
  radius_m: meters.optional().nullable(),
  server_visit_id: z.number().int().positive().optional().nullable(),
  order_latitude: lat.optional().nullable(),
  order_longitude: lng.optional().nullable(),
  order_accuracy_m: meters.optional().nullable(),
  order_is_mocked: z.boolean().optional(),
  tracking: z.boolean().optional(),
  offline: z.boolean().optional()
});

export type MobileOrderVisitInput = z.infer<typeof mobileOrderVisitSchema>;
