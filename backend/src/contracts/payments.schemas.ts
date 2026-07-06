import { z } from "zod";
import type { PaymentListQuery, PaymentListSortKey } from "../modules/payments/payments.service";

/** Query param — musbat butun son (ixtiyoriy) */
export function parseOptPositiveInt(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseOptAmount(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseFloat(raw.trim().replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseCommaSeparatedIds(raw: string | undefined): number[] | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const ids = raw
    .split(/[,]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
}

const PAYMENT_LIST_SORT_KEYS = new Set<string>([
  "payment_id",
  "paid_at",
  "created_at",
  "confirmed_at",
  "amount",
  "payment_type",
  "note",
  "client_name",
  "order_id",
  "agent",
  "trade_direction",
  "consignment",
  "expeditor",
  "territory",
  "last_change",
  "changed_by"
]);

/** GET `/api/:slug/payments` query — string parametrlardan `PaymentListQuery` */
export function parsePaymentsListQuery(q: Record<string, string | undefined>): PaymentListQuery {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));

  const client_id = parseOptPositiveInt(q.client_id);
  const order_id = parseOptPositiveInt(q.order_id);
  const agent_id = parseOptPositiveInt(q.agent_id);
  const agent_ids = parseCommaSeparatedIds(q.agent_ids);
  const expeditor_user_id = parseOptPositiveInt(q.expeditor_user_id);
  const expeditor_user_ids = parseCommaSeparatedIds(q.expeditor_user_ids);

  const date_from = q.date_from?.trim() || undefined;
  const date_to = q.date_to?.trim() || undefined;
  const search = q.search?.trim() || undefined;

  const amount_min = parseOptAmount(q.amount_min);
  const amount_max = parseOptAmount(q.amount_max);

  const payment_typeRaw = q.payment_type?.trim();
  const payment_type =
    payment_typeRaw && payment_typeRaw !== "" && payment_typeRaw !== "__all__" ? payment_typeRaw : undefined;

  const trade_directionRaw = q.trade_direction?.trim();
  const trade_direction =
    trade_directionRaw && trade_directionRaw !== "" && trade_directionRaw !== "__all__"
      ? trade_directionRaw
      : undefined;

  const territory_region = q.territory_region?.trim() || undefined;
  const territory_city = q.territory_city?.trim() || undefined;
  const territory_district = q.territory_district?.trim() || undefined;
  const territory_zone = q.territory_zone?.trim() || undefined;

  const dt = q.deal_type?.trim();
  let deal_type: PaymentListQuery["deal_type"] | undefined;
  if (dt === "regular" || dt === "consignment" || dt === "both") {
    deal_type = dt;
  }

  const ps = q.payment_status?.trim();
  let payment_status: PaymentListQuery["payment_status"] | undefined;
  if (ps === "pending_confirmation" || ps === "confirmed" || ps === "deleted" || ps === "rejected") {
    payment_status = ps;
  }

  const acRaw = q.application_channel?.trim().toLowerCase();
  let application_channel: PaymentListQuery["application_channel"] | undefined;
  if (acRaw === "expeditor" || acRaw === "collector" || acRaw === "van" || acRaw === "bank") {
    application_channel = acRaw;
  }

  const cash_desk_ids = parseCommaSeparatedIds(q.cash_desk_ids);

  const ekRaw = q.entry_kind?.trim();
  let entry_kind: PaymentListQuery["entry_kind"] | undefined;
  if (ekRaw === "client_expense" || ekRaw === "payment" || ekRaw === "discount_settlement") {
    entry_kind = ekRaw;
  }

  const dfRaw = q.date_field?.trim();
  let date_field: PaymentListQuery["date_field"] | undefined;
  if (dfRaw === "created_at" || dfRaw === "paid_at" || dfRaw === "confirmed_at") {
    date_field = dfRaw;
  }

  const sortByRaw = q.sort_by?.trim();
  let sort_by: PaymentListSortKey | undefined;
  if (sortByRaw && PAYMENT_LIST_SORT_KEYS.has(sortByRaw)) {
    sort_by = sortByRaw as PaymentListSortKey;
  }
  const sortDirRaw = q.sort_dir?.trim().toLowerCase();
  let sort_dir: "asc" | "desc" | undefined;
  if (sort_by !== undefined) {
    sort_dir = sortDirRaw === "asc" ? "asc" : "desc";
  }

  return {
    page,
    limit,
    ...(client_id !== undefined ? { client_id } : {}),
    ...(order_id !== undefined ? { order_id } : {}),
    ...(date_from ? { date_from } : {}),
    ...(date_to ? { date_to } : {}),
    ...(search ? { search } : {}),
    ...(amount_min !== undefined ? { amount_min } : {}),
    ...(amount_max !== undefined ? { amount_max } : {}),
    ...(agent_ids !== undefined ? { agent_ids } : agent_id !== undefined ? { agent_id } : {}),
    ...(expeditor_user_ids !== undefined
      ? { expeditor_user_ids }
      : expeditor_user_id !== undefined
        ? { expeditor_user_id }
        : {}),
    ...(payment_type ? { payment_type } : {}),
    ...(trade_direction ? { trade_direction } : {}),
    ...(territory_region ? { territory_region } : {}),
    ...(territory_city ? { territory_city } : {}),
    ...(territory_district ? { territory_district } : {}),
    ...(territory_zone ? { territory_zone } : {}),
    ...(deal_type !== undefined && deal_type !== "both" ? { deal_type } : {}),
    ...(payment_status !== undefined ? { payment_status } : {}),
    ...(application_channel !== undefined ? { application_channel } : {}),
    ...(cash_desk_ids !== undefined ? { cash_desk_ids } : {}),
    ...(entry_kind !== undefined ? { entry_kind } : {}),
    ...(date_field !== undefined ? { date_field } : {}),
    ...(sort_by !== undefined ? { sort_by, sort_dir: sort_dir ?? "desc" } : {})
  };
}

/** Zod wrapper — `safeParse` uchun query obyektini qabul qiladi */
export const paymentsListQuerySchema = z
  .record(z.string(), z.union([z.string(), z.undefined()]).optional())
  .transform((q) => parsePaymentsListQuery(q as Record<string, string | undefined>));

/** POST `/api/:slug/payments` */
export const createPaymentBodySchema = z.object({
  client_id: z.number().int().positive(),
  order_id: z.number().int().positive().nullable().optional(),
  amount: z.number().positive(),
  payment_type: z.string().min(1).max(64),
  note: z.string().max(2000).optional().nullable(),
  cash_desk_id: z.number().int().positive().nullable().optional(),
  paid_at: z.string().max(40).optional().nullable(),
  entry_kind: z.enum(["payment", "client_expense", "discount_settlement"]).optional(),
  expeditor_user_id: z.number().int().positive().nullable().optional(),
  ledger_agent_id: z.number().int().positive().nullable().optional(),
  allocation_mode: z.enum(["cash", "consignment", "none"]).optional(),
  allocation_order_ids: z.array(z.number().int().positive()).max(500).optional(),
  allocation_agent_id: z.number().int().positive().nullable().optional()
});

/** PATCH `/api/:slug/payments/:id` */
export const patchPaymentBodySchema = z
  .object({
    amount: z.number().positive().optional(),
    payment_type: z.string().min(1).max(64).optional(),
    note: z.string().max(2000).optional().nullable(),
    cash_desk_id: z.number().int().positive().nullable().optional(),
    paid_at: z.string().max(48).optional().nullable(),
    order_id: z.number().int().positive().nullable().optional(),
    expeditor_user_id: z.number().int().positive().nullable().optional(),
    ledger_agent_id: z.number().int().positive().nullable().optional()
  })
  .refine(
    (b) =>
      b.amount !== undefined ||
      b.payment_type !== undefined ||
      b.note !== undefined ||
      b.cash_desk_id !== undefined ||
      b.paid_at !== undefined ||
      b.order_id !== undefined ||
      b.expeditor_user_id !== undefined ||
      b.ledger_agent_id !== undefined,
    { message: "empty" }
  );

/** POST `/api/:slug/payments/:id/reject` */
export const rejectPaymentBodySchema = z.object({
  reason: z.string().max(500).optional()
});

/** POST `/api/:slug/payments/batch-confirm` */
export const batchConfirmPaymentsBodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100)
});

/** DELETE `/api/:slug/payments/:id` query */
export const deletePaymentQuerySchema = z.object({
  cancel_reason_ref: z.string().max(128).optional()
});

/** POST `/api/:slug/payments/:id/restore` */
export const restorePaymentBodySchema = z.object({
  comment: z.string().trim().min(1).max(2000)
});

/** POST `/api/:slug/payments/:id/edit-grants` */
export const createPaymentEditGrantBodySchema = z.object({
  duration_minutes: z.number().int().min(1).max(43200),
  access_user_id: z.number().int().positive(),
  cancel_reason_ref: z.string().max(128).nullable().optional(),
  comment: z.string().max(2000).nullable().optional()
});

/** GET `/api/:slug/payments/order-cash-in/context` */
export const orderCashInContextQuerySchema = z.object({
  client_id: z.coerce.number().int().positive(),
  order_ids: z.string().max(8000).optional()
});

/** POST `/api/:slug/payments/order-cash-in` */
export const createOrderCashInBodySchema = z.object({
  client_id: z.number().int().positive(),
  cash_desk_id: z.number().int().positive().nullable().optional(),
  paid_at: z.string().max(48).optional().nullable(),
  lines: z
    .array(
      z.object({
        order_id: z.number().int().positive(),
        payment_type: z.string().min(1).max(64),
        amount: z.number().positive()
      })
    )
    .min(1)
    .max(5000)
});
