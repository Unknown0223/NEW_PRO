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
import { buildOrderCreatedLocalDateClause } from "./client-balances.date";
import { sqlIntIdToNumber } from "./client-balances.payments.util";
import { sqlOrderMerchandiseNetReceivable } from "../orders/order-merchandise-net";
export type DeliveryDebtInfo = { debt: Prisma.Decimal; lastDel: Date | null; firstDel: Date | null };

/** Yetkazilgan savdo zakazlari bo‘yicha to‘lanmagan qoldiq (mijoz bo‘yicha). */
export async function loadDeliveryDebtByClient(
  tenantId: number,
  clientIds: number[],
  orderDateFrom?: string | null,
  orderDateTo?: string | null
): Promise<Map<number, DeliveryDebtInfo>> {
  const map = new Map<number, DeliveryDebtInfo>();
  if (clientIds.length === 0) return map;
  const orderDateClause = buildOrderCreatedLocalDateClause(orderDateFrom ?? null, orderDateTo ?? null);
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const rows = await prisma.$queryRaw<
      Array<{
        client_id: number;
        gross_unpaid: Prisma.Decimal;
        last_unpaid_delivery: Date | null;
        first_unpaid_delivery: Date | null;
      }>
    >`
      WITH cand AS (
        SELECT o.id, o.tenant_id, o.client_id, o.total_sum, o.discount_sum, o.applied_auto_bonus_rule_ids, o.updated_at
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.order_type = 'order'
          AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
          AND o.client_id IN (${Prisma.join(chunk)})
          ${orderDateClause}
      ),
      alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
          AND pa.order_id IN (SELECT id FROM cand)
        GROUP BY pa.order_id
      ),
      delivered AS (
        SELECT sl.order_id, MIN(sl.created_at) AS delivered_at
        FROM order_status_logs sl
        WHERE sl.order_id IN (SELECT id FROM cand)
          AND sl.to_status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
        GROUP BY sl.order_id
      ),
      ord AS (
        SELECT
          c.client_id,
          ${sqlOrderMerchandiseNetReceivable("c")} AS merchandise_net,
          COALESCE(d.delivered_at, c.updated_at) AS delivered_at,
          COALESCE(a.allocated, 0)::decimal(15,2) AS allocated
        FROM cand c
        LEFT JOIN alloc a ON a.order_id = c.id
        LEFT JOIN delivered d ON d.order_id = c.id
      ),
      agg AS (
        SELECT
          client_id,
          SUM(GREATEST(merchandise_net - allocated, 0))::decimal(15,2) AS gross_unpaid,
          MAX(delivered_at) FILTER (WHERE (merchandise_net - allocated) > 0) AS last_unpaid_delivery,
          MIN(delivered_at) FILTER (WHERE (merchandise_net - allocated) > 0) AS first_unpaid_delivery
        FROM ord
        GROUP BY client_id
      )
      SELECT client_id, gross_unpaid, last_unpaid_delivery, first_unpaid_delivery
      FROM agg
      WHERE gross_unpaid > 0
    `;
    for (const r of rows) {
      const cid = sqlIntIdToNumber(r.client_id);
      if (!Number.isFinite(cid)) continue;
      map.set(cid, {
        debt: r.gross_unpaid,
        lastDel: r.last_unpaid_delivery,
        firstDel: r.first_unpaid_delivery
      });
    }
  }
  return map;
}

/** Yetkazilgan zakazlar bo‘yicha to‘lanmagan va ledger — eng “yomon” balans (minimal qiymat). */
export function mergeLedgerWithUnpaidDelivered(
  ledger: Prisma.Decimal,
  unpaidDelivered: DeliveryDebtInfo | undefined
): Prisma.Decimal {
  if (!unpaidDelivered || unpaidDelivered.debt.lte(0)) return ledger;
  const fromOrders = unpaidDelivered.debt.neg();
  return fromOrders.cmp(ledger) < 0 ? fromOrders : ledger;
}

export type UnpaidDeliveredOrderRow = {
  order_id: number;
  order_number: string;
  client_id: number;
  unpaid: Prisma.Decimal;
  delivered_at: Date | null;
  payment_method_ref: string | null;
};

/** «По доставке»: har bir qator — bitta yetkazilgan, to‘lanmagan zakaz. */
export async function loadUnpaidDeliveredOrderDebtRows(
  tenantId: number,
  clientIds: number[],
  orderDateFrom: string | null,
  orderDateTo: string | null,
  filterOrderId: number | null
): Promise<UnpaidDeliveredOrderRow[]> {
  if (clientIds.length === 0) return [];
  const orderDateClause = buildOrderCreatedLocalDateClause(orderDateFrom, orderDateTo);
  const orderIdClause =
    filterOrderId != null && filterOrderId > 0 ? Prisma.sql`AND o.id = ${filterOrderId}` : Prisma.empty;
  const out: UnpaidDeliveredOrderRow[] = [];
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const rows = await prisma.$queryRaw<
      Array<{
        order_id: number;
        order_number: string;
        client_id: number;
        unpaid: Prisma.Decimal;
        delivered_at: Date | null;
        payment_method_ref: string | null;
      }>
    >`
      WITH cand AS (
        SELECT o.id, o.tenant_id, o.number, o.client_id, o.total_sum, o.discount_sum, o.applied_auto_bonus_rule_ids, o.updated_at, o.payment_method_ref
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.order_type = 'order'
          AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
          AND o.client_id IN (${Prisma.join(chunk)})
          ${orderDateClause}
          ${orderIdClause}
      ),
      alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
          AND pa.order_id IN (SELECT id FROM cand)
        GROUP BY pa.order_id
      ),
      delivered AS (
        SELECT sl.order_id, MIN(sl.created_at) AS delivered_at
        FROM order_status_logs sl
        WHERE sl.order_id IN (SELECT id FROM cand)
          AND sl.to_status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
        GROUP BY sl.order_id
      )
      SELECT
        c.id AS order_id,
        c.number AS order_number,
        c.client_id,
        GREATEST(${sqlOrderMerchandiseNetReceivable("c")} - COALESCE(a.sum_amt, 0), 0)::decimal(15,2) AS unpaid,
        COALESCE(d.delivered_at, c.updated_at) AS delivered_at,
        c.payment_method_ref
      FROM cand c
      LEFT JOIN alloc a ON a.order_id = c.id
      LEFT JOIN delivered d ON d.order_id = c.id
    `;
    for (const r of rows) {
      if (r.unpaid.gt(0)) {
        const cid = sqlIntIdToNumber(r.client_id);
        const oid = sqlIntIdToNumber(r.order_id);
        if (!Number.isFinite(cid) || !Number.isFinite(oid)) continue;
        out.push({
          order_id: oid,
          order_number: r.order_number,
          client_id: cid,
          unpaid: r.unpaid,
          delivered_at: r.delivered_at,
          payment_method_ref: r.payment_method_ref
        });
      }
    }
  }
  out.sort((a, b) => {
    const c = b.unpaid.cmp(a.unpaid);
    return c !== 0 ? c : b.order_id - a.order_id;
  });
  return out;
}
