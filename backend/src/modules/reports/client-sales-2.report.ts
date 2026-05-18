import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ClientSales2Filters, ReportActor } from "./client-sales-2.types";
import { buildClientScopeSql, buildOrderWhereSql, productFilterSql } from "./client-sales-2.where";

export async function getClientSales2Report(tenantId: number, f: ClientSales2Filters, actor?: ReportActor) {
  const whereSql = buildOrderWhereSql(tenantId, f, actor);
  const clientScopeSql = buildClientScopeSql(tenantId, f, actor);
  const itemSql = productFilterSql(f);
  const hasItemFilter = Boolean(
    (f.product_ids && f.product_ids.length) ||
      (f.category_ids && f.category_ids.length) ||
      (f.product_group_ids && f.product_group_ids.length) ||
      (f.segment_ids && f.segment_ids.length)
  );
  const offset = (f.page - 1) * f.limit;
  const sumFrom = typeof f.sum_from === "number" ? f.sum_from : null;
  const sumTo = typeof f.sum_to === "number" ? f.sum_to : null;

  const listRows = await prisma.$queryRaw<
    Array<{
      client_id: number;
      client_name: string;
      created_at: Date;
      category: string | null;
      amount: Prisma.Decimal;
      qty: Prisma.Decimal;
      volume: Prisma.Decimal;
      agent_name: string | null;
      agent_code: string | null;
      territory: string | null;
      phone: string | null;
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
    filtered_orders AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        COALESCE(o.agent_id, c.agent_id) AS agent_id,
        c.name AS client_name,
        c.created_at AS client_created_at,
        c.category AS client_category,
        c.phone AS client_phone,
        c.zone,
        c.region,
        c.city,
        COALESCE(it.item_amount, 0)::numeric(15,2) AS amount,
        COALESCE(it.item_qty, 0)::numeric(15,3) AS qty,
        COALESCE(it.item_volume, 0)::numeric(15,3) AS volume
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS item_amount,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_qty,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_volume,
          COUNT(*)::int AS item_count
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
        ${itemSql}
      ) it ON true
      WHERE ${whereSql}
        ${hasItemFilter ? Prisma.sql`AND COALESCE(it.item_count, 0) > 0` : Prisma.empty}
    ),
    client_agg AS (
      SELECT
        fo.client_id,
        MAX(fo.client_name) AS client_name,
        MAX(fo.client_created_at) AS created_at,
        MAX(fo.client_category) AS category,
        MAX(fo.client_phone) AS phone,
        COALESCE(SUM(fo.amount), 0)::numeric(15,2) AS amount,
        COALESCE(SUM(fo.qty), 0)::numeric(15,3) AS qty,
        COALESCE(SUM(fo.volume), 0)::numeric(15,3) AS volume,
        MAX(u.name) AS agent_name,
        MAX(u.code) AS agent_code,
        CONCAT_WS(' / ', NULLIF(MAX(fo.zone), ''), NULLIF(MAX(fo.region), ''), NULLIF(MAX(fo.city), '')) AS territory
      FROM filtered_orders fo
      LEFT JOIN users u ON u.id = fo.agent_id
      GROUP BY fo.client_id
      HAVING (${sumFrom}::numeric IS NULL OR COALESCE(SUM(fo.amount), 0) >= ${sumFrom}::numeric)
         AND (${sumTo}::numeric IS NULL OR COALESCE(SUM(fo.amount), 0) <= ${sumTo}::numeric)
    )
    SELECT *
    FROM client_agg
    ORDER BY amount DESC, client_id DESC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const countRows = await prisma.$queryRaw<Array<{ total: bigint; amount_total: Prisma.Decimal; qty_total: Prisma.Decimal; volume_total: Prisma.Decimal }>>`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    ),
    filtered_orders AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        COALESCE(o.agent_id, c.agent_id) AS agent_id,
        COALESCE(it.item_amount, 0)::numeric(15,2) AS amount,
        COALESCE(it.item_qty, 0)::numeric(15,3) AS qty,
        COALESCE(it.item_volume, 0)::numeric(15,3) AS volume
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS item_amount,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_qty,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_volume,
          COUNT(*)::int AS item_count
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
        ${itemSql}
      ) it ON true
      WHERE ${whereSql}
        ${hasItemFilter ? Prisma.sql`AND COALESCE(it.item_count, 0) > 0` : Prisma.empty}
    ),
    client_agg AS (
      SELECT
        fo.client_id,
        COALESCE(SUM(fo.amount), 0)::numeric(15,2) AS amount,
        COALESCE(SUM(fo.qty), 0)::numeric(15,3) AS qty,
        COALESCE(SUM(fo.volume), 0)::numeric(15,3) AS volume
      FROM filtered_orders fo
      GROUP BY fo.client_id
      HAVING (${sumFrom}::numeric IS NULL OR COALESCE(SUM(fo.amount), 0) >= ${sumFrom}::numeric)
         AND (${sumTo}::numeric IS NULL OR COALESCE(SUM(fo.amount), 0) <= ${sumTo}::numeric)
    )
    SELECT
      COUNT(*)::bigint AS total,
      COALESCE(SUM(amount), 0)::numeric(15,2) AS amount_total,
      COALESCE(SUM(qty), 0)::numeric(15,3) AS qty_total,
      COALESCE(SUM(volume), 0)::numeric(15,3) AS volume_total
    FROM client_agg
  `;

  const agentRows = await prisma.$queryRaw<
    Array<{ agent_id: number | null; agent_name: string | null; agent_code: string | null; akb: bigint; qty: Prisma.Decimal; volume: Prisma.Decimal; amount: Prisma.Decimal }>
  >`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    ),
    filtered_orders AS (
      SELECT
        o.client_id,
        COALESCE(o.agent_id, c.agent_id) AS agent_id,
        COALESCE(it.item_amount, 0)::numeric(15,2) AS amount,
        COALESCE(it.item_qty, 0)::numeric(15,3) AS qty,
        COALESCE(it.item_volume, 0)::numeric(15,3) AS volume
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS item_amount,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_qty,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_volume,
          COUNT(*)::int AS item_count
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
        ${itemSql}
      ) it ON true
      WHERE ${whereSql}
        ${hasItemFilter ? Prisma.sql`AND COALESCE(it.item_count, 0) > 0` : Prisma.empty}
    ),
    client_agg AS (
      SELECT
        fo.client_id,
        fo.agent_id,
        COALESCE(SUM(fo.amount), 0)::numeric(15,2) AS amount,
        COALESCE(SUM(fo.qty), 0)::numeric(15,3) AS qty,
        COALESCE(SUM(fo.volume), 0)::numeric(15,3) AS volume
      FROM filtered_orders fo
      GROUP BY fo.client_id, fo.agent_id
      HAVING (${sumFrom}::numeric IS NULL OR COALESCE(SUM(fo.amount), 0) >= ${sumFrom}::numeric)
         AND (${sumTo}::numeric IS NULL OR COALESCE(SUM(fo.amount), 0) <= ${sumTo}::numeric)
    )
    SELECT
      ca.agent_id,
      MAX(u.name) AS agent_name,
      MAX(u.code) AS agent_code,
      COUNT(DISTINCT ca.client_id)::bigint AS akb,
      COALESCE(SUM(ca.qty), 0)::numeric(15,3) AS qty,
      COALESCE(SUM(ca.volume), 0)::numeric(15,3) AS volume,
      COALESCE(SUM(ca.amount), 0)::numeric(15,2) AS amount
    FROM client_agg ca
    LEFT JOIN users u ON u.id = ca.agent_id
    GROUP BY ca.agent_id
    ORDER BY amount DESC
  `;

  const okbRows = await prisma.$queryRaw<Array<{ agent_id: number | null; okb: bigint }>>`
    SELECT
      c.agent_id,
      COUNT(DISTINCT c.id)::bigint AS okb
    FROM clients c
    WHERE ${clientScopeSql}
    GROUP BY c.agent_id
  `;
  const okbMap = new Map(okbRows.map((r) => [String(r.agent_id ?? 0), Number(r.okb)]));

  return {
    clients: listRows.map((r) => ({
      client_id: r.client_id,
      client_name: r.client_name,
      created_at: r.created_at.toISOString(),
      category: r.category ?? "",
      amount: r.amount.toString(),
      qty: r.qty.toString(),
      volume: r.volume.toString(),
      agent_name: r.agent_name ?? "—",
      agent_code: r.agent_code ?? "",
      territory: r.territory ?? "—",
      phone: r.phone ?? ""
    })),
    agents_summary: agentRows.map((r) => {
      const okb = okbMap.get(String(r.agent_id ?? 0)) ?? 0;
      const akb = Number(r.akb ?? 0n);
      const pct = okb > 0 ? (akb / okb) * 100 : 0;
      return {
        agent_id: r.agent_id,
        agent_name: r.agent_name ?? "—",
        agent_code: r.agent_code ?? "",
        akb,
        okb,
        akb_percent: Number(pct.toFixed(2)),
        qty: r.qty.toString(),
        volume: r.volume.toString(),
        amount: r.amount.toString()
      };
    }),
    totals: {
      amount: (countRows[0]?.amount_total ?? new Prisma.Decimal(0)).toString(),
      quantity: (countRows[0]?.qty_total ?? new Prisma.Decimal(0)).toString(),
      volume: (countRows[0]?.volume_total ?? new Prisma.Decimal(0)).toString()
    },
    page: f.page,
    limit: f.limit,
    total: Number(countRows[0]?.total ?? 0n)
  };
}

