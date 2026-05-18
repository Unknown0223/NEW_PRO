import { z } from "zod";

const dateLikeSchema = z.string().trim().min(1).optional().nullable();

/** POST `/api/:slug/mobile/sync/full` */
export const mobileSyncFullBodySchema = z.object({
  last_sync_at: dateLikeSchema
});

/** POST `/api/:slug/mobile/sync/delta` */
export const mobileSyncDeltaBodySchema = z.object({
  last_sync_at: dateLikeSchema,
  entity_type: z.enum(["clients", "products", "prices", "orders"]).optional()
});

const enqueueItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive(),
  price: z.number().nonnegative().optional()
});

/** POST `/api/:slug/mobile/orders/enqueue` */
export const mobileEnqueueBodySchema = z
  .object({
    client_local_id: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
    client_id: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
    items: z.array(enqueueItemSchema).min(1),
    offline_created_at: dateLikeSchema
  })
  .superRefine((val, ctx) => {
    if (val.client_local_id == null && val.client_id == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["client_id"],
        message: "client_local_id or client_id is required"
      });
    }
  });

/** POST `/api/:slug/mobile/fcm/register` */
export const mobileRegisterFcmBodySchema = z.object({
  token: z.string().trim().min(1),
  device_type: z.enum(["android", "ios", "web"]).optional()
});
