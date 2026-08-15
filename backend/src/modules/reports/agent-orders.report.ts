import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import { buildFilterSql } from "./agent-orders.helpers";

export async function getAgentOrdersReport(
  tenantId: number,
  f: AgentOrdersFilters,
  actor?: { userId: number | null; role: string }
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildFilterSql(tenantId, f, scopedActor);

  const summary = await prisma.$queryRaw<Array<{ status: string; amount: Prisma.Decimal; qty: bigint; akb: bigint }>>`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    )
    SELECT
      o.status,
      COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS amount,
      COUNT(DISTINCT o.id)::bigint AS qty,
      COUNT(DISTINCT o.client_id)::bigint AS akb
    FROM orders o
    LEFT JOIN users u ON u.id = o.agent_id
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    WHERE ${whereSql}
    GROUP BY o.status
  `;

  const summaryMap = new Map(summary.map((s) => [s.status, s]));
  const kpiOrder = ["all", "new", "cancelled", "confirmed", "delivering", "delivered", "return_processing", "returned"];
  const statusCards = kpiOrder.map((status) => {
    if (status === "all") {
      const amount = summary.reduce((a, x) => a.plus(x.amount), new Prisma.Decimal(0));
      const qty = summary.reduce((a, x) => a + Number(x.qty), 0);
      const akb = summary.reduce((a, x) => a + Number(x.akb), 0);
      return { status, amount: amount.toString(), qty, akb };
    }
    const s = summaryMap.get(status);
    return { status, amount: (s?.amount ?? new Prisma.Decimal(0)).toString(), qty: Number(s?.qty ?? 0n), akb: Number(s?.akb ?? 0n) };
  });

  const byAgent = await prisma.$queryRaw<
    Array<{
      agent_id: number | null;
      agent_name: string | null;
      agent_code: string | null;
      amount_total: Prisma.Decimal;
      amount_new: Prisma.Decimal;
      amount_confirmed: Prisma.Decimal;
      amount_delivering: Prisma.Decimal;
      amount_delivered: Prisma.Decimal;
      amount_cancelled: Prisma.Decimal;
      amount_returned: Prisma.Decimal;
      amount_return_processing: Prisma.Decimal;
      qty_total: bigint;
      qty_new: bigint;
      qty_confirmed: bigint;
      qty_delivering: bigint;
      qty_delivered: bigint;
      qty_cancelled: bigint;
      qty_returned: bigint;
      qty_return_processing: bigint;
      volume_total: Prisma.Decimal;
      volume_new: Prisma.Decimal;
      volume_confirmed: Prisma.Decimal;
      volume_delivering: Prisma.Decimal;
      volume_delivered: Prisma.Decimal;
      volume_cancelled: Prisma.Decimal;
      volume_returned: Prisma.Decimal;
      volume_return_processing: Prisma.Decimal;
      akb_total: bigint;
      akb_new: bigint;
      akb_confirmed: bigint;
      akb_delivering: bigint;
      akb_delivered: bigint;
      akb_cancelled: bigint;
      akb_returned: bigint;
      akb_return_processing: bigint;
    }>
  >`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    ),
    item_totals AS (
      SELECT
        oi.order_id,
        COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS qty_sum
      FROM order_items oi
      GROUP BY oi.order_id
    )
    SELECT
      o.agent_id,
      MAX(u.name) AS agent_name,
      MAX(u.code) AS agent_code,
      COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS amount_total,
      COALESCE(SUM(CASE WHEN o.status = 'new' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_new,
      COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_confirmed,
      COALESCE(SUM(CASE WHEN o.status = 'delivering' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_delivering,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_delivered,
      COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_cancelled,
      COALESCE(SUM(CASE WHEN o.status = 'returned' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_returned,
      COALESCE(SUM(CASE WHEN o.status = 'return_processing' THEN o.total_sum ELSE 0 END), 0)::numeric(15,2) AS amount_return_processing,
      COUNT(DISTINCT o.id)::bigint AS qty_total,
      COUNT(DISTINCT CASE WHEN o.status = 'new' THEN o.id END)::bigint AS qty_new,
      COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.id END)::bigint AS qty_confirmed,
      COUNT(DISTINCT CASE WHEN o.status = 'delivering' THEN o.id END)::bigint AS qty_delivering,
      COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END)::bigint AS qty_delivered,
      COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END)::bigint AS qty_cancelled,
      COUNT(DISTINCT CASE WHEN o.status = 'returned' THEN o.id END)::bigint AS qty_returned,
      COUNT(DISTINCT CASE WHEN o.status = 'return_processing' THEN o.id END)::bigint AS qty_return_processing,
      COALESCE(SUM(COALESCE(it.qty_sum, 0)), 0)::numeric(18,6) AS volume_total,
      COALESCE(SUM(CASE WHEN o.status = 'new' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_new,
      COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_confirmed,
      COALESCE(SUM(CASE WHEN o.status = 'delivering' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_delivering,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_delivered,
      COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_cancelled,
      COALESCE(SUM(CASE WHEN o.status = 'returned' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_returned,
      COALESCE(SUM(CASE WHEN o.status = 'return_processing' THEN COALESCE(it.qty_sum, 0) ELSE 0 END), 0)::numeric(18,6) AS volume_return_processing,
      COUNT(DISTINCT o.client_id)::bigint AS akb_total,
      COUNT(DISTINCT CASE WHEN o.status = 'new' THEN o.client_id END)::bigint AS akb_new,
      COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.client_id END)::bigint AS akb_confirmed,
      COUNT(DISTINCT CASE WHEN o.status = 'delivering' THEN o.client_id END)::bigint AS akb_delivering,
      COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.client_id END)::bigint AS akb_delivered,
      COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.client_id END)::bigint AS akb_cancelled,
      COUNT(DISTINCT CASE WHEN o.status = 'returned' THEN o.client_id END)::bigint AS akb_returned,
      COUNT(DISTINCT CASE WHEN o.status = 'return_processing' THEN o.client_id END)::bigint AS akb_return_processing
    FROM orders o
    LEFT JOIN users u ON u.id = o.agent_id
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    LEFT JOIN item_totals it ON it.order_id = o.id
    WHERE ${whereSql}
    GROUP BY o.agent_id
    ORDER BY amount_total DESC
  `;

  const byCategory = await prisma.$queryRaw<
    Array<{
      agent_id: number | null;
      agent_name: string | null;
      agent_code: string | null;
      bucket: string;
      amount: Prisma.Decimal;
      qty: bigint;
      volume: Prisma.Decimal;
      akb: bigint;
    }>
  >`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    )
    SELECT
      o.agent_id,
      MAX(u.name) AS agent_name,
      MAX(u.code) AS agent_code,
      COALESCE(pc.name, '—') AS bucket,
      COALESCE(SUM(oi.total), 0)::numeric(15,2) AS amount,
      COUNT(DISTINCT o.id)::bigint AS qty,
      COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS volume,
      COUNT(DISTINCT o.client_id)::bigint AS akb
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN users u ON u.id = o.agent_id
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    WHERE ${whereSql}
    GROUP BY o.agent_id, pc.name
    ORDER BY o.agent_id, bucket
  `;

  const bySegment = await prisma.$queryRaw<
    Array<{
      agent_id: number | null;
      agent_name: string | null;
      agent_code: string | null;
      bucket: string;
      amount: Prisma.Decimal;
      qty: bigint;
      volume: Prisma.Decimal;
      akb: bigint;
    }>
  >`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    )
    SELECT
      o.agent_id,
      MAX(u.name) AS agent_name,
      MAX(u.code) AS agent_code,
      COALESCE(ps.name, '—') AS bucket,
      COALESCE(SUM(oi.total), 0)::numeric(15,2) AS amount,
      COUNT(DISTINCT o.id)::bigint AS qty,
      COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS volume,
      COUNT(DISTINCT o.client_id)::bigint AS akb
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_segments ps ON ps.id = p.segment_id
    LEFT JOIN users u ON u.id = o.agent_id
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    WHERE ${whereSql}
    GROUP BY o.agent_id, ps.name
    ORDER BY o.agent_id, bucket
  `;

  const toMatrix = (
    rows: Array<{
      agent_id: number | null;
      agent_name: string | null;
      agent_code: string | null;
      bucket: string;
      amount: Prisma.Decimal;
      qty: bigint;
      volume: Prisma.Decimal;
      akb: bigint;
    }>
  ) => {
    const buckets = [...new Set(rows.map((r) => r.bucket))];
    const map = new Map<
      string,
      {
        agent_id: number | null;
        agent_name: string;
        agent_code: string;
        values: Record<string, { amount: string; qty: number; volume: string; akb: number }>;
      }
    >();
    for (const r of rows) {
      const key = String(r.agent_id ?? 0);
      if (!map.has(key)) {
        map.set(key, {
          agent_id: r.agent_id,
          agent_name: r.agent_name ?? "—",
          agent_code: r.agent_code ?? "",
          values: {}
        });
      }
      map.get(key)!.values[r.bucket] = {
        amount: r.amount.toString(),
        qty: Number(r.qty),
        volume: r.volume.toString(),
        akb: Number(r.akb)
      };
    }
    return { buckets, rows: [...map.values()] };
  };

  return {
    status_cards: statusCards,
    agent_rows: byAgent.map((r) => ({
      agent_id: r.agent_id,
      agent_name: r.agent_name ?? "—",
      agent_code: r.agent_code ?? "",
      amount_total: r.amount_total.toString(),
      amount_new: r.amount_new.toString(),
      amount_confirmed: r.amount_confirmed.toString(),
      amount_delivering: r.amount_delivering.toString(),
      amount_delivered: r.amount_delivered.toString(),
      amount_cancelled: r.amount_cancelled.toString(),
      amount_returned: r.amount_returned.toString(),
      amount_return_processing: r.amount_return_processing.toString(),
      qty_total: Number(r.qty_total),
      qty_new: Number(r.qty_new),
      qty_confirmed: Number(r.qty_confirmed),
      qty_delivering: Number(r.qty_delivering),
      qty_delivered: Number(r.qty_delivered),
      qty_cancelled: Number(r.qty_cancelled),
      qty_returned: Number(r.qty_returned),
      qty_return_processing: Number(r.qty_return_processing),
      volume_total: r.volume_total.toString(),
      volume_new: r.volume_new.toString(),
      volume_confirmed: r.volume_confirmed.toString(),
      volume_delivering: r.volume_delivering.toString(),
      volume_delivered: r.volume_delivered.toString(),
      volume_cancelled: r.volume_cancelled.toString(),
      volume_returned: r.volume_returned.toString(),
      volume_return_processing: r.volume_return_processing.toString(),
      akb_total: Number(r.akb_total),
      akb_new: Number(r.akb_new),
      akb_confirmed: Number(r.akb_confirmed),
      akb_delivering: Number(r.akb_delivering),
      akb_delivered: Number(r.akb_delivered),
      akb_cancelled: Number(r.akb_cancelled),
      akb_returned: Number(r.akb_returned),
      akb_return_processing: Number(r.akb_return_processing)
    })),
    category_matrix: toMatrix(byCategory),
    segment_matrix: toMatrix(bySegment)
  };
}
