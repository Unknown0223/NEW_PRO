import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

import { LARGE_CLIENT_IDS_CHUNK } from "./client-balances.constants";
import { sqlIntIdToNumber } from "./client-balances.payments.util";

export async function loadBalancesAsOf(
  tenantId: number,
  clientIds: number[],
  asOfEnd: Date
): Promise<Map<number, Prisma.Decimal>> {
  const out = new Map<number, Prisma.Decimal>();
  if (clientIds.length === 0) return out;
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const rows = await prisma.$queryRaw<Array<{ client_id: number; bal: Prisma.Decimal | null }>>`
      SELECT cb.client_id,
        COALESCE(SUM(cbm.delta), 0)::decimal(15,2) AS bal
      FROM client_balances cb
      LEFT JOIN client_balance_movements cbm
        ON cbm.client_balance_id = cb.id AND cbm.created_at <= ${asOfEnd}
      WHERE cb.tenant_id = ${tenantId}
        AND cb.client_id IN (${Prisma.join(chunk)})
      GROUP BY cb.client_id
    `;
    for (const r of rows) {
      const cid = sqlIntIdToNumber(r.client_id);
      if (!Number.isFinite(cid)) continue;
      out.set(cid, r.bal ?? new Prisma.Decimal(0));
    }
  }
  return out;
}

export async function loadLastPaymentByClient(
  tenantId: number,
  clientIds: number[],
  asOfEnd: Date | null
): Promise<Map<number, Date>> {
  const out = new Map<number, Date>();
  if (clientIds.length === 0) return out;
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const dateClause = asOfEnd
      ? Prisma.sql`AND COALESCE(paid_at, created_at) <= ${asOfEnd}`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{ client_id: number; lp: Date | null }>>`
      SELECT client_id,
        MAX(COALESCE(paid_at, created_at)) AS lp
      FROM client_payments
      WHERE tenant_id = ${tenantId}
        AND entry_kind = 'payment'
        AND deleted_at IS NULL
        AND client_id IN (${Prisma.join(chunk)})
        ${dateClause}
      GROUP BY client_id
    `;
    for (const r of rows) {
      if (r.lp) {
        const cid = sqlIntIdToNumber(r.client_id);
        if (Number.isFinite(cid)) out.set(cid, r.lp);
      }
    }
  }
  return out;
}

export async function loadLastDeliveryByClient(
  tenantId: number,
  clientIds: number[]
): Promise<Map<number, Date>> {
  const out = new Map<number, Date>();
  if (clientIds.length === 0) return out;
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const rows = await prisma.$queryRaw<Array<{ client_id: number; lu: Date | null }>>`
      SELECT o.client_id,
        MAX(COALESCE(
          (SELECT MIN(sl.created_at) FROM order_status_logs sl
           WHERE sl.order_id = o.id AND sl.to_status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})),
          o.updated_at
        )) AS lu
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.status <> 'cancelled'
        AND o.order_type = 'order'
        AND o.client_id IN (${Prisma.join(chunk)})
      GROUP BY o.client_id
    `;
    for (const r of rows) {
      if (r.lu) {
        const cid = sqlIntIdToNumber(r.client_id);
        if (Number.isFinite(cid)) out.set(cid, r.lu);
      }
    }
  }
  return out;
}
