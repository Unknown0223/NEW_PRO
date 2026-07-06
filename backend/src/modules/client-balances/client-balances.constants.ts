import { Prisma } from "@prisma/client";

export const ORDER_CREATED_UTC_OFFSET_HOURS = 5; // Asia/Tashkent (UTC+5)
export const LARGE_CLIENT_IDS_CHUNK = 10000;
export const BALANCE_PERF_LOG = process.env.BALANCE_PERF_LOG === "1";

/** Kassir / tizim tasdiqlamagan kirimlar qarzni yopgan hisoblanmaydi (`workflow_status`). */
export const PAYMENT_COUNTS_FOR_RECEIVABLE_NET = Prisma.sql`AND COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'`;

/** Skidka to‘lovi — «Балансы клиентов» jadvalida alohida ustun. */
export const DISCOUNT_SETTLEMENT_PAYMENT_LABEL = "Оплата скидки";
export const DISCOUNT_SETTLEMENT_PAY_TYPE_KEY = "__discount_settlement__";

export const agentInclude = {
  select: {
    id: true,
    name: true,
    code: true,
    consignment: true,
    trade_direction: true,
    supervisor_user_id: true,
    supervisor: { select: { name: true } },
    trade_direction_row: { select: { name: true } }
  }
} as const;
