import { z } from "zod";

const orderLineItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive()
});

const bonusGiftOverrideSchema = z.object({
  bonus_rule_id: z.number().int().positive(),
  bonus_product_id: z.number().int().positive()
});

const exchangeLineSchema = z.object({
  order_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  qty: z.number().positive()
});

const plusLineSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive()
});

/** POST `/api/:slug/orders` tanasi */
export const createOrderBodySchema = z
  .object({
    client_id: z.number().int().positive(),
    warehouse_id: z.number().int().positive(),
    agent_id: z.number().int().positive().nullable().optional(),
    expeditor_user_id: z.number().int().positive().nullable().optional(),
    price_type: z.string().trim().min(1).max(128).optional().nullable(),
    order_type: z.enum(["order", "return", "exchange", "partial_return", "return_by_order"]).optional(),
    apply_bonus: z.boolean().optional(),
    bonus_gift_overrides: z.array(bonusGiftOverrideSchema).optional(),
    comment: z.string().max(4000).optional().nullable(),
    request_type_ref: z.string().trim().max(128).optional().nullable(),
    is_consignment: z.boolean().optional(),
    consignment_due_date: z.string().max(40).optional().nullable(),
    items: z.array(orderLineItemSchema).default([]),
    payment_method_ref: z.string().trim().max(64).optional().nullable(),
    source_order_ids: z.array(z.number().int().positive()).optional(),
    minus_lines: z.array(exchangeLineSchema).optional(),
    plus_lines: z.array(plusLineSchema).optional(),
    reason_ref: z.string().trim().max(256).optional().nullable()
  })
  .superRefine((data, ctx) => {
    const ot = data.order_type ?? "order";
    if (ot === "exchange") {
      if (!data.source_order_ids?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Manba zakazlar (source_order_ids) majburiy",
          path: ["source_order_ids"]
        });
      }
      if (!data.minus_lines?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Kamayuvchi qatorlar (minus_lines) majburiy",
          path: ["minus_lines"]
        });
      }
      if (!data.plus_lines?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Qo‘shiluvchi qatorlar (plus_lines) majburiy",
          path: ["plus_lines"]
        });
      }
      return;
    }
    if (!data.items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kamida bitta qator kerak",
        path: ["items"]
      });
    }
    if (ot !== "order") return;
    if (data.agent_id == null || data.agent_id < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Agent majburiy",
        path: ["agent_id"]
      });
    }
  });

function parseOptionalPosInt(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return !Number.isNaN(n) && n > 0 ? n : undefined;
}

function parseAgentIds(raw: string | undefined): number[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
}

function parseConsignmentFlag(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

/** GET `/api/:slug/orders` query — string query parametrlarini servis shakliga */
export const ordersListQuerySchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().optional(),
    q: z.string().optional(),
    search: z.string().optional(),
    client_id: z.string().optional(),
    warehouse_id: z.string().optional(),
    agent_id: z.string().optional(),
    agent_ids: z.string().optional(),
    no_agent: z.string().optional(),
    expeditor_id: z.string().optional(),
    expeditor_user_id: z.string().optional(),
    client_category: z.string().optional(),
    client_region: z.string().optional(),
    client_city: z.string().optional(),
    client_zone: z.string().optional(),
    trade_direction: z.string().optional(),
    product_id: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    order_type: z.string().optional(),
    is_consignment: z.string().optional(),
    product_category_id: z.string().optional(),
    payment_type: z.string().optional(),
    payment_method_ref: z.string().optional(),
    request_type_ref: z.string().optional(),
    price_type: z.string().optional(),
    visit_weekday: z.string().optional(),
    date_mode: z.string().optional(),
    cursor: z.string().optional()
  })
  .transform((q) => {
    const pageNum = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));
    const search = (q.q ?? q.search ?? "").trim() || undefined;
    const noAgentRaw = q.no_agent?.trim().toLowerCase();
    const include_no_agent = noAgentRaw === "1" || noAgentRaw === "true" || noAgentRaw === "yes";
    const agent_ids = parseAgentIds(q.agent_ids);
    return {
      page: pageNum,
      limit: limitNum,
      status: q.status?.trim() || undefined,
      search,
      client_id: parseOptionalPosInt(q.client_id),
      warehouse_id: parseOptionalPosInt(q.warehouse_id),
      agent_id: agent_ids?.length ? undefined : parseOptionalPosInt(q.agent_id),
      agent_ids,
      include_no_agent: include_no_agent || undefined,
      expeditor_user_id: parseOptionalPosInt(q.expeditor_id ?? q.expeditor_user_id),
      client_category: q.client_category?.trim() || undefined,
      client_region: q.client_region?.trim() || undefined,
      client_city: q.client_city?.trim() || undefined,
      client_zone: q.client_zone?.trim() || undefined,
      agent_trade_direction: q.trade_direction?.trim() || undefined,
      product_id: parseOptionalPosInt(q.product_id),
      date_from: q.date_from?.trim() || q.from?.trim() || undefined,
      date_to: q.date_to?.trim() || q.to?.trim() || undefined,
      order_type: q.order_type?.trim() || undefined,
      is_consignment: parseConsignmentFlag(q.is_consignment),
      product_category_id: parseOptionalPosInt(q.product_category_id),
      payment_type: q.payment_type?.trim() || undefined,
      payment_method_ref: q.payment_method_ref?.trim() || undefined,
      request_type_ref: q.request_type_ref?.trim() || undefined,
      list_price_type: q.price_type?.trim() || undefined,
      visit_weekday: (() => {
        const n = Number.parseInt(q.visit_weekday ?? "", 10);
        return Number.isFinite(n) && n >= 1 && n <= 7 ? n : undefined;
      })(),
      date_mode: q.date_mode?.trim() || undefined,
      cursor: q.cursor?.trim() || undefined
    };
  });

export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>;

const orderIdsBulkSchema = z.array(z.number().int().positive()).min(1).max(500);

/** PATCH `/api/:slug/orders/:id/status` */
export const patchOrderStatusBodySchema = z.object({
  status: z.string().min(1),
  /** Holat logidagi vaqt (ISO 8601). Bo‘lmasa — hozir. */
  occurred_at: z.string().datetime({ offset: true }).optional()
});

/** POST `/api/:slug/orders/bulk/status` */
export const bulkOrderStatusBodySchema = z.object({
  order_ids: orderIdsBulkSchema,
  status: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true }).optional()
});

/** PATCH `/api/:slug/orders/:id/milestone-at` — mavjud bosqich log vaqtini tuzatish */
export const patchOrderMilestoneAtBodySchema = z.object({
  milestone: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true })
});

/** POST `/api/:slug/orders/bulk/nakladnoy` */
export const bulkOrderNakladnoyBodySchema = z.object({
  order_ids: orderIdsBulkSchema,
  template: z.enum(["nakladnoy_warehouse", "nakladnoy_expeditor"]),
  /** «Загруз зав.склада» — 13 ta alohida Excel andoza */
  warehouse_layout: z
    .enum([
      "wh-1.1",
      "wh-1.1.2",
      "wh-4.1",
      "wh-4.1.1",
      "wh-4.1.2",
      "wh-6.0",
      "wh-6.0.1",
      "wh-6.0.2",
      "wh-7.0.0",
      "wh-7.0.1",
      "wh-xprinter",
      "wh-7.0.3",
      "wh-7.0.4"
    ])
    .optional(),
  /** «Загруз экспедитор» — 518 andoza (5.1.8) */
  expeditor_loading_layout: z
    .enum([
      "ex-3.0",
      "ex-4.0.1",
      "ex-4.1.0",
      "ex-5.0",
      "ex-5.0.6",
      "ex-5.1.0",
      "ex-5.1.0.1",
      "ex-5.1.6",
      "ex-5.1.8",
      "ex-5.2.0"
    ])
    .optional(),
  format: z.enum(["xlsx", "pdf"]).optional(),
  code_column: z.enum(["sku", "barcode"]).optional(),
  separate_sheets: z.boolean().optional(),
  group_by: z.enum(["territory", "agent", "expeditor"]).optional()
});

/** POST `/api/:slug/orders/bulk/expeditor` */
export const bulkOrderExpeditorBodySchema = z.object({
  order_ids: orderIdsBulkSchema,
  /** null — ekspeditordan yechish */
  expeditor_user_id: z.number().int().positive().nullable()
});

/** POST `/api/:slug/orders/bulk/consignment` */
export const bulkOrderConsignmentBodySchema = z.object({
  order_ids: orderIdsBulkSchema,
  is_consignment: z.boolean(),
  consignment_due_date: z.string().max(40).optional().nullable()
});

/** PATCH `/api/:slug/orders/:id/lines` */
export const patchOrderLinesBodySchema = z.object({
  warehouse_id: z.number().int().positive().nullable().optional(),
  agent_id: z.number().int().positive().nullable().optional(),
  payment_method_ref: z.string().trim().max(64).optional().nullable(),
  apply_bonus: z.boolean().optional(),
  bonus_gift_overrides: z.array(bonusGiftOverrideSchema).optional(),
  items: z.array(orderLineItemSchema).min(1)
});

/** PATCH `/api/:slug/orders/:id` meta maydonlari */
export const patchOrderMetaBodySchema = z
  .object({
    warehouse_id: z.number().int().positive().nullable().optional(),
    agent_id: z.number().int().positive().nullable().optional(),
    expeditor_user_id: z.number().int().positive().nullable().optional(),
    comment: z.string().max(4000).optional().nullable(),
    payment_method_ref: z.string().trim().max(64).optional().nullable(),
    warehouse_block_id: z.number().int().positive().nullable().optional()
  })
  .refine(
    (b) =>
      b.warehouse_id !== undefined ||
      b.agent_id !== undefined ||
      b.expeditor_user_id !== undefined ||
      b.comment !== undefined ||
      b.payment_method_ref !== undefined ||
      b.warehouse_block_id !== undefined,
    {
      message:
        "At least one of warehouse_id, agent_id, expeditor_user_id, comment, payment_method_ref, warehouse_block_id"
    }
  );
