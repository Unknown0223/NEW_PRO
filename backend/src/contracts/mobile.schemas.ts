import { z } from "zod";
import { CLIENT_PHOTO_MAX_BASE64_LEN } from "../lib/client-photo-limits";

const dateLikeSchema = z.string().trim().min(1).optional().nullable();

/** POST `/api/:slug/mobile/presence` — qurilma nomi va APK (sinxronizatsiyasiz). */
export const mobilePresenceBodySchema = z.object({
  device_name: z.string().max(255).nullable().optional(),
  user_agent: z.string().max(512).nullable().optional(),
  apk_version: z.string().max(64).nullable().optional()
});

/** POST `/api/:slug/mobile/sync/full` */
export const mobileSyncFullBodySchema = z.object({
  last_sync_at: dateLikeSchema,
  /** Eski 50-limit katalogini qayta yuklash — barcha agent mijozlari. */
  force_clients_catalog: z.boolean().optional(),
  device_name: z.string().max(255).nullable().optional(),
  user_agent: z.string().max(512).nullable().optional(),
  apk_version: z.string().max(64).nullable().optional()
});

/** POST `/api/:slug/mobile/sync/delta` */
export const mobileSyncDeltaBodySchema = z.object({
  last_sync_at: dateLikeSchema,
  entity_type: z.enum(["clients", "products", "prices", "orders"]).optional(),
  device_name: z.string().max(255).nullable().optional(),
  user_agent: z.string().max(512).nullable().optional(),
  apk_version: z.string().max(64).nullable().optional()
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
    warehouse_id: z.number().int().positive(),
    items: z.array(enqueueItemSchema).min(1),
    offline_created_at: dateLikeSchema,
    price_type: z.string().trim().min(1).max(128).optional(),
    comment: z.string().max(4000).optional().nullable()
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

/** GET `/api/:slug/mobile/orders/create-context` */
export const mobileOrderCreateContextQuerySchema = z.object({
  selected_client_id: z.coerce.number().int().positive().optional(),
  selected_warehouse_id: z.coerce.number().int().positive().optional()
});

/** GET `/api/:slug/mobile/orders/stock` */
export const mobileOrderStockQuerySchema = z.object({
  warehouse_id: z.coerce.number().int().positive(),
  product_ids: z.string().trim().min(1)
});

/** GET `/api/:slug/mobile/warehouse-stock` — ombor qoldig‘i (agent scope, bitta javob) */
export const mobileWarehouseStockQuerySchema = z.object({
  warehouse_id: z.coerce.number().int().positive().optional()
});

/** GET `/api/:slug/mobile/orders/history` — agent bugungi zakazlar */
export const mobileOrdersHistoryQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

const mobileCreateOrderItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive()
});

const mobileClientOptionalFieldsSchema = {
  address: z.string().trim().max(2000).optional().nullable(),
  latitude: z.number().finite().gte(-90).lte(90).optional().nullable(),
  longitude: z.number().finite().gte(-180).lte(180).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  legal_name: z.string().trim().max(512).optional().nullable(),
  inn: z.string().trim().max(64).optional().nullable(),
  category: z.string().trim().max(255).optional().nullable(),
  sales_channel: z.string().trim().max(255).optional().nullable(),
  client_type_code: z.string().trim().max(128).optional().nullable(),
  region: z.string().trim().max(255).optional().nullable(),
  zone: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(255).optional().nullable(),
  visit_date: z.string().trim().max(32).optional().nullable(),
  client_code: z.string().trim().max(32).optional().nullable(),
  bank_name: z.string().trim().max(255).optional().nullable(),
  bank_mfo: z.string().trim().max(64).optional().nullable(),
  oked: z.string().trim().max(64).optional().nullable(),
  client_pinfl: z.string().trim().max(20).optional().nullable(),
  contract_number: z.string().trim().max(128).optional().nullable()
};

/** POST `/api/:slug/mobile/me/change-password` */
export const mobileChangePasswordBodySchema = z.object({
  old_password: z.string().min(1).max(128),
  new_password: z.string().min(6).max(128)
});

/** PATCH `/api/:slug/mobile/me/profile` */
export const mobilePatchProfileBodySchema = z
  .object({
    first_name: z.string().trim().max(128).nullable().optional(),
    last_name: z.string().trim().max(128).nullable().optional(),
    phone: z.string().trim().max(32).nullable().optional(),
    avatar_base64: z.string().max(180_000).nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

/** POST `/api/:slug/mobile/clients/:id/photo-reports — agent mijoz fotosi */
export const mobileClientPhotoBodySchema = z.object({
  image_base64: z.string().trim().min(80).max(CLIENT_PHOTO_MAX_BASE64_LEN),
  caption: z.string().trim().max(1000).nullable().optional(),
  order_id: z.number().int().positive().optional()
});

export const mobileClientPhotoLinkBodySchema = z.object({
  order_id: z.number().int().positive()
});

/** POST `/api/:slug/mobile/clients` — agent yangi savdo nuqtasi */
export const mobileCreateClientBodySchema = z.object({
  name: z.string().trim().min(3).max(255),
  phone: z.string().trim().min(5).max(80),
  visit_weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  ...mobileClientOptionalFieldsSchema
});

/** PATCH `/api/:slug/mobile/clients/:id` — agent bog‘langan mijoz */
export const mobilePatchClientBodySchema = z
  .object({
    name: z.string().trim().min(1).max(512).optional(),
    phone: z.string().trim().max(64).optional().nullable(),
    ...mobileClientOptionalFieldsSchema
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

const mobileBonusGiftOverrideSchema = z.object({
  bonus_rule_id: z.number().int().positive(),
  bonus_product_id: z.number().int().positive()
});

const mobileBonusGiftLineSchema = z.object({
  bonus_rule_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  qty: z.number().positive()
});

/** POST `/api/:slug/mobile/orders/bonus-preview` */
export const mobileOrderBonusPreviewBodySchema = z.object({
  client_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive(),
  price_type: z.string().trim().min(1).max(128).optional(),
  items: z.array(mobileCreateOrderItemSchema).min(1),
  bonus_gift_overrides: z.array(mobileBonusGiftOverrideSchema).optional(),
  bonus_gift_lines: z.array(mobileBonusGiftLineSchema).optional()
});

/** POST `/api/:slug/mobile/orders/create` — veb `POST /orders` bilan bir xil bonus/skidka */
export const mobileCreateOrderBodySchema = z.object({
  client_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive(),
  price_type: z.string().trim().min(1).max(128).optional(),
  apply_bonus: z.boolean().optional(),
  apply_discount: z.boolean().optional(),
  bonus_gift_overrides: z.array(mobileBonusGiftOverrideSchema).optional(),
  bonus_gift_lines: z.array(mobileBonusGiftLineSchema).optional(),
  comment: z.string().max(4000).optional().nullable(),
  is_consignment: z.boolean().optional(),
  consignment_due_date: z.string().max(40).optional().nullable(),
  shipment_date: z.string().max(40).optional().nullable(),
  items: z.array(mobileCreateOrderItemSchema).min(1)
});

/** POST `/api/:slug/mobile/expeditor/orders/:id/payments` */
export const mobileExpeditorPaymentBodySchema = z.object({
  payment_type: z.string().trim().min(1).max(128),
  amount: z.number().positive(),
  note: z.string().trim().max(1000).nullable().optional()
});

/** POST `/api/:slug/mobile/expeditor/orders/:id/partial-return` */
export const mobileExpeditorPartialReturnBodySchema = z.object({
  reason: z.string().trim().min(1).max(255),
  note: z.string().trim().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        order_item_id: z.number().int().positive(),
        qty: z.number().positive()
      })
    )
    .max(200)
    .optional()
});

/** POST `/api/:slug/mobile/expeditor/orders/:id/reload-from-vehicle` */
export const mobileExpeditorReloadBodySchema = z.object({
  note: z.string().trim().max(1000).nullable().optional()
});

/** POST `/api/:slug/mobile/expeditor/orders/:id/return-by-order` — «Возврат с полки по заказу» */
export const mobileExpeditorReturnByOrderBodySchema = z.object({
  lines: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        qty: z.number().min(0).optional(),
        paid_qty: z.number().min(0).optional(),
        bonus_qty: z.number().min(0).optional(),
        return_qty: z.number().min(0).optional(),
        bonus_target_product_id: z.number().int().positive().optional()
      })
    )
    .min(1)
    .max(500),
  note: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().max(128).nullable().optional()
});

/** POST `/api/:slug/mobile/expeditor/orders/:id/return-by-order/preview` */
export const mobileExpeditorReturnByOrderPreviewBodySchema = z.object({
  lines: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        return_qty: z.number().positive()
      })
    )
    .min(1)
    .max(500)
});

/** PATCH `/api/:slug/mobile/expeditor/clients/:id/location` */
export const mobileExpeditorClientLocationBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
