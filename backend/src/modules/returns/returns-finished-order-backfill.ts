import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { applyClientReturnRefund } from "./returns-enhanced.refund-ledger";

type Row = {
  id: number;
  tenant_id: number;
  client_id: number;
  total_sum: Prisma.Decimal;
  number: string | null;
  agent_id: number | null;
  created_at: Date;
};

/**
 * Eski yakuniy vozvrat-zakazlar (`delivered` yoki `returned`) uchun refund yozuvi va balans.
 * Posted sales_return yoki shu zakazga refund bor bo‘lsa — teginilmaydi.
 */
export async function backfillFinishedReturnOrderRefunds(): Promise<{ created: number; scanned: number }> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT o.id, o.tenant_id, o.client_id, o.total_sum, o.number, o.agent_id, o.created_at
    FROM orders o
    WHERE o.order_type IN ('return', 'return_by_order', 'partial_return')
      AND o.status IN ('delivered', 'returned')
      AND o.client_id IS NOT NULL
      AND COALESCE(o.total_sum, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM sales_returns sr
        WHERE sr.tenant_id = o.tenant_id
          AND sr.status = 'posted'
          AND COALESCE(sr.refund_amount, 0) > 0
          AND (sr.mirror_order_id = o.id OR sr.order_id = o.id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM client_payments p
        WHERE p.tenant_id = o.tenant_id
          AND p.client_id = o.client_id
          AND p.deleted_at IS NULL
          AND p.entry_kind = 'refund'
          AND p.order_id = o.id
      )
  `;

  let created = 0;
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      await applyClientReturnRefund(tx, row.tenant_id, row.client_id, row.total_sum, null, {
        returnNumber: row.number ?? String(row.id),
        orderId: row.id,
        ledgerAgentId: row.agent_id,
        paidAt: row.created_at
      });
    });
    created += 1;
  }
  return { created, scanned: rows.length };
}

export function startFinishedReturnOrderBackfill(): void {
  void backfillFinishedReturnOrderRefunds()
    .then((r) => {
      if (r.created > 0) {
        logger.info(r, "Finished return orders posted to client balance");
      }
    })
    .catch((err) => {
      logger.error({ err }, "Finished return order backfill failed");
    });
}
