import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import { tashkentDayEndUtc, tashkentDayStartUtc } from "./client-balances.date";

/** Yetkazilgan zakaz konsignatsiyami: belgi, agent yoki narx turi. */
export function consignmentMatchSql(): Prisma.Sql {
  return Prisma.sql`(
    o.is_consignment = true
    OR COALESCE(ag.consignment, false) = true
    OR o.price_type ILIKE '%консигнац%'
    OR o.price_type ILIKE '%consignment%'
  )`;
}

/**
 * Muddat: yozilgan `consignment_due_date`, bo‘lmasa buyurtma urilgan oyning
 * oxirgi kuni (Toshkent). Import ham bo‘sh muddatni shu kunga yozadi.
 */
export function effectiveDueSql(): Prisma.Sql {
  return Prisma.sql`COALESCE(
    o.consignment_due_date,
    (
      date_trunc('month', timezone('Asia/Tashkent', o.created_at))
      + interval '1 month'
      - interval '1 day'
    ) AT TIME ZONE 'Asia/Tashkent'
  )`;
}

function dueRangeSql(dueFrom?: string | null, dueTo?: string | null): Prisma.Sql {
  const from = dueFrom?.trim() ? tashkentDayStartUtc(dueFrom) : null;
  const to = dueTo?.trim() ? tashkentDayEndUtc(dueTo) : null;
  const due = effectiveDueSql();
  if (from && to) return Prisma.sql`AND ${due} >= ${from} AND ${due} <= ${to}`;
  if (from) return Prisma.sql`AND ${due} >= ${from}`;
  if (to) return Prisma.sql`AND ${due} <= ${to}`;
  return Prisma.empty;
}

export async function clientIdsWithConsignmentDue(
  tenantId: number,
  dueFrom?: string | null,
  dueTo?: string | null
): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ client_id: number }>>`
    SELECT DISTINCT o.client_id
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'order'
      AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
      AND o.client_id IS NOT NULL
      ${dueRangeSql(dueFrom, dueTo)}
  `;
  return rows.map((r) => r.client_id).filter((id) => Number.isFinite(id));
}

/** Sahifa qatoridagi «Срок»: shu oralikdagi eng yaqin konsignatsiya muddati. */
export async function loadConsignmentDueByClient(
  tenantId: number,
  clientIds: number[],
  dueFrom?: string | null,
  dueTo?: string | null
): Promise<Map<number, Date>> {
  const map = new Map<number, Date>();
  if (clientIds.length === 0) return map;
  const rows = await prisma.$queryRaw<Array<{ client_id: number; due: Date }>>`
    SELECT o.client_id, MIN(${effectiveDueSql()}) AS due
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      AND o.client_id IN (${Prisma.join(clientIds)})
      AND o.order_type = 'order'
      AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
      ${dueRangeSql(dueFrom, dueTo)}
    GROUP BY o.client_id
  `;
  for (const r of rows) {
    if (r.due) map.set(r.client_id, r.due);
  }
  return map;
}

/** Dev: muddati bo‘sh buyurtmaga urilgan oyning oxirgi kuni. Qayta ishga tushirish xavfsiz. */
export function startMonthEndDueBackfill(): void {
  if (process.env.NODE_ENV === "production") return;
  void (async () => {
    const updated = await prisma.$executeRaw`
      UPDATE orders
      SET consignment_due_date = (
        date_trunc('month', timezone('Asia/Tashkent', created_at))
        + interval '1 month'
        - interval '1 day'
      ) AT TIME ZONE 'Asia/Tashkent'
      WHERE consignment_due_date IS NULL
        AND created_at IS NOT NULL
    `;
    const august = await clientIdsWithConsignmentDue(1, "2026-08-01", "2026-08-31");
    logger.info(
      { updated: Number(updated), augustClients: august.length },
      "month-end due backfill"
    );
  })().catch((err) => {
    logger.error({ err }, "month-end due backfill failed");
  });
}
