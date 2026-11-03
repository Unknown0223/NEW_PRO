import { Prisma } from "@prisma/client";

export const ORDER_CREATED_UTC_OFFSET_HOURS = 5; // Asia/Tashkent (UTC+5)
export const LARGE_CLIENT_IDS_CHUNK = 10000;
export const BALANCE_PERF_LOG = process.env.BALANCE_PERF_LOG === "1";

/** Tasdiqlanmagan, rad etilgan va o‘chirilgan kirim qarzni yopmaydi. */
export const PAYMENT_COUNTS_FOR_RECEIVABLE_NET = Prisma.sql`AND COALESCE(p.workflow_status, 'confirmed') NOT IN ('pending_confirmation', 'rejected', 'deleted')`;

/**
 * Kassa to‘lovi qaytarish hujjatining o‘zi (summa teng).
 * Vedomost shu hujjatni alohida kredit qiladi, ikkinchi marta qo‘shilmaydi.
 * `refund` qatori qoladi: u bo‘lsa hujjat krediti o‘chiq.
 */
export const PAYMENT_NOT_RETURN_MIRROR = Prisma.sql`
  AND NOT (
    p.entry_kind = 'payment'
    AND EXISTS (
      SELECT 1 FROM orders ro
      WHERE ro.id = p.order_id
        AND ro.tenant_id = p.tenant_id
        AND ro.order_type IN ('return', 'return_by_order', 'partial_return')
        AND ro.status IN ('delivered', 'returned')
        AND COALESCE(ro.total_sum, 0) > 0
        AND ABS(p.amount - ro.total_sum) < 1
    )
  )
`;

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
