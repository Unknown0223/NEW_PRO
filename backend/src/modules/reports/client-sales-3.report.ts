import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import { VISIT_WEEKDAY_RU_ABBREV } from "../clients/clients.visit-weekdays";
import type { ClientSales2Filters, ReportActor } from "./client-sales-2.types";
import { buildClientScopeSql, buildOrderWhereSql, productFilterSql } from "./client-sales-2.where";

function formatWeekdays(raw: unknown): string {
  const arr = Array.isArray(raw) ? raw : [];
  const days = arr
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  return days.map((d) => VISIT_WEEKDAY_RU_ABBREV[d] ?? String(d)).join(",");
}

export async function getClientSales3Report(tenantId: number, f: ClientSales2Filters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildOrderWhereSql(tenantId, f, scopedActor);
  const clientScopeSql = buildClientScopeSql(tenantId, f, scopedActor);
  const itemSql = productFilterSql(f);
  const hasItemFilter = Boolean(
    (f.product_ids && f.product_ids.length) ||
      (f.category_ids && f.category_ids.length) ||
      (f.product_group_ids && f.product_group_ids.length) ||
      (f.segment_ids && f.segment_ids.length) ||
      (f.brand_ids && f.brand_ids.length)
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
      is_active: boolean;
      amount: Prisma.Decimal;
      qty: Prisma.Decimal;
      volume: Prisma.Decimal;
      agents_list: string | null;
      visit_weekdays: unknown;
      last_order_at: Date | null;
      days_since_last: number | null;
      city: string | null;
      address: string | null;
      phone: string | null;
      expeditor_name: string | null;
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
    period_sales AS (
      SELECT
        o.client_id,
        COALESCE(SUM(COALESCE(it.item_amount, 0)), 0)::numeric(15,2) AS amount,
        COALESCE(SUM(COALESCE(it.item_qty, 0)), 0)::numeric(15,3) AS qty,
        COALESCE(SUM(COALESCE(it.item_volume, 0)), 0)::numeric(15,3) AS volume
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS item_amount,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_qty,
          COALESCE(SUM(oi.qty * COALESCE(p.volume_m3, 0)), 0)::numeric(15,6) AS item_volume,
          COUNT(*)::int AS item_count
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
        ${itemSql}
      ) it ON true
      WHERE ${whereSql}
        ${hasItemFilter ? Prisma.sql`AND COALESCE(it.item_count, 0) > 0` : Prisma.empty}
      GROUP BY o.client_id
    ),
    last_orders AS (
      SELECT o.client_id, MAX(o.created_at) AS last_order_at
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE o.tenant_id = ${tenantId}
        AND o.status <> 'cancelled'
        AND c.merged_into_client_id IS NULL
      GROUP BY o.client_id
    ),
    agents_agg AS (
      SELECT
        caa.client_id,
        STRING_AGG(DISTINCT NULLIF(u.name, ''), ', ') AS agents_list
      FROM client_agent_assignments caa
      JOIN users u ON u.id = caa.agent_id
      WHERE caa.tenant_id = ${tenantId}
        AND caa.agent_id IS NOT NULL
      GROUP BY caa.client_id
    ),
    days_agg AS (
      SELECT
        caa.client_id,
        (
          SELECT COALESCE(jsonb_agg(DISTINCT d.ord), '[]'::jsonb)
          FROM client_agent_assignments caa2
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(caa2.visit_weekdays::jsonb, '[]'::jsonb)) AS el(val)
          CROSS JOIN LATERAL (SELECT NULLIF(el.val, '')::int AS ord) d
          WHERE caa2.client_id = caa.client_id
            AND caa2.tenant_id = ${tenantId}
            AND d.ord BETWEEN 1 AND 7
        ) AS visit_weekdays
      FROM client_agent_assignments caa
      WHERE caa.tenant_id = ${tenantId}
      GROUP BY caa.client_id
    ),
    expeditor_agg AS (
      SELECT DISTINCT ON (caa.client_id)
        caa.client_id,
        u.name AS expeditor_name
      FROM client_agent_assignments caa
      JOIN users u ON u.id = caa.expeditor_user_id
      WHERE caa.tenant_id = ${tenantId}
        AND caa.expeditor_user_id IS NOT NULL
      ORDER BY caa.client_id, caa.slot ASC
    ),
    base AS (
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        c.created_at,
        c.category,
        c.is_active,
        c.city,
        c.address,
        c.phone,
        COALESCE(ps.amount, 0)::numeric(15,2) AS amount,
        COALESCE(ps.qty, 0)::numeric(15,3) AS qty,
        COALESCE(ps.volume, 0)::numeric(15,3) AS volume,
        aa.agents_list,
        da.visit_weekdays,
        lo.last_order_at,
        CASE
          WHEN lo.last_order_at IS NULL THEN NULL
          ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - lo.last_order_at)) / 86400))::int
        END AS days_since_last,
        ea.expeditor_name
      FROM clients c
      LEFT JOIN period_sales ps ON ps.client_id = c.id
      LEFT JOIN last_orders lo ON lo.client_id = c.id
      LEFT JOIN agents_agg aa ON aa.client_id = c.id
      LEFT JOIN days_agg da ON da.client_id = c.id
      LEFT JOIN expeditor_agg ea ON ea.client_id = c.id
      WHERE ${clientScopeSql}
        AND c.merged_into_client_id IS NULL
        AND (${sumFrom}::numeric IS NULL OR COALESCE(ps.amount, 0) >= ${sumFrom}::numeric)
        AND (${sumTo}::numeric IS NULL OR COALESCE(ps.amount, 0) <= ${sumTo}::numeric)
    )
    SELECT *
    FROM base
    ORDER BY amount DESC, client_id DESC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const countRows = await prisma.$queryRaw<
    Array<{ total: bigint; amount_total: Prisma.Decimal; qty_total: Prisma.Decimal; volume_total: Prisma.Decimal }>
  >`
    WITH status_logs AS (
      SELECT
        sl.order_id,
        MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
        MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
      FROM order_status_logs sl
      GROUP BY sl.order_id
    ),
    period_sales AS (
      SELECT
        o.client_id,
        COALESCE(SUM(COALESCE(it.item_amount, 0)), 0)::numeric(15,2) AS amount,
        COALESCE(SUM(COALESCE(it.item_qty, 0)), 0)::numeric(15,3) AS qty,
        COALESCE(SUM(COALESCE(it.item_volume, 0)), 0)::numeric(15,3) AS volume
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS item_amount,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS item_qty,
          COALESCE(SUM(oi.qty * COALESCE(p.volume_m3, 0)), 0)::numeric(15,6) AS item_volume,
          COUNT(*)::int AS item_count
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
        ${itemSql}
      ) it ON true
      WHERE ${whereSql}
        ${hasItemFilter ? Prisma.sql`AND COALESCE(it.item_count, 0) > 0` : Prisma.empty}
      GROUP BY o.client_id
    )
    SELECT
      COUNT(*)::bigint AS total,
      COALESCE(SUM(COALESCE(ps.amount, 0)), 0)::numeric(15,2) AS amount_total,
      COALESCE(SUM(COALESCE(ps.qty, 0)), 0)::numeric(15,3) AS qty_total,
      COALESCE(SUM(COALESCE(ps.volume, 0)), 0)::numeric(15,3) AS volume_total
    FROM clients c
    LEFT JOIN period_sales ps ON ps.client_id = c.id
    WHERE ${clientScopeSql}
      AND c.merged_into_client_id IS NULL
      AND (${sumFrom}::numeric IS NULL OR COALESCE(ps.amount, 0) >= ${sumFrom}::numeric)
      AND (${sumTo}::numeric IS NULL OR COALESCE(ps.amount, 0) <= ${sumTo}::numeric)
  `;

  return {
    clients: listRows.map((r) => ({
      client_id: r.client_id,
      client_name: r.client_name,
      created_at: r.created_at.toISOString(),
      category: r.category ?? "",
      active: r.is_active,
      amount: r.amount.toString(),
      qty: r.qty.toString(),
      volume: r.volume.toString(),
      agents_list: r.agents_list?.trim() || "—",
      visit_days: formatWeekdays(r.visit_weekdays),
      last_order: r.last_order_at ? r.last_order_at.toISOString().slice(0, 10) : null,
      days_since_last: r.days_since_last,
      city: r.city ?? "—",
      address: r.address ?? "",
      phone: r.phone ?? "",
      expeditor_name: r.expeditor_name?.trim() || "—"
    })),
    totals: {
      amount: (countRows[0]?.amount_total ?? new Prisma.Decimal(0)).toString(),
      qty: (countRows[0]?.qty_total ?? new Prisma.Decimal(0)).toString(),
      quantity: (countRows[0]?.qty_total ?? new Prisma.Decimal(0)).toString(),
      volume: (countRows[0]?.volume_total ?? new Prisma.Decimal(0)).toString()
    },
    page: f.page,
    limit: f.limit,
    total: Number(countRows[0]?.total ?? 0n)
  };
}
