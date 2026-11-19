import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import { P1_RETURN_ORDER_TYPES } from "./p1.pure";
import type { P1AggCellRaw, P1ReportFilters } from "./p1.types";
import { STATUS_CTE } from "./product-sales.agg";

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

function dateExprSql(dateType: P1ReportFilters["date_type"]): Prisma.Sql {
  if (dateType === "delivered_date") return Prisma.sql`sl.delivered_at`;
  if (dateType === "shipped_date") return Prisma.sql`sl.shipped_at`;
  return Prisma.sql`o.created_at`;
}

export async function queryP1AggCells(
  tenantId: number,
  f: P1ReportFilters,
  actor?: ReportActor
): Promise<P1AggCellRaw[]> {
  const yMin = Math.min(f.year, f.compare_year);
  const yMax = Math.max(f.year, f.compare_year);
  const from = new Date(Date.UTC(yMin, 0, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(yMax, 11, 31, 23, 59, 59, 999));
  const dateExpr = dateExprSql(f.date_type);

  const returnTypes = [...P1_RETURN_ORDER_TYPES];
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.status <> 'cancelled'`,
    Prisma.sql`o.order_type IN ('order', ${Prisma.join(returnTypes.map((t) => Prisma.sql`${t}`))})`,
    Prisma.sql`${dateExpr} IS NOT NULL`,
    Prisma.sql`${dateExpr} >= ${from}`,
    Prisma.sql`${dateExpr} <= ${to}`
  ];

  if (f.trade_direction_ids.length > 0) {
    parts.push(
      Prisma.sql`(
        EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = COALESCE(o.agent_id, c.agent_id)
            AND au.tenant_id = ${tenantId}
            AND au.trade_direction_id IN (${Prisma.join(f.trade_direction_ids)})
        )
        OR EXISTS (
          SELECT 1 FROM product_trade_direction_links ptd
          WHERE ptd.product_id = oi.product_id
            AND ptd.trade_direction_id IN (${Prisma.join(f.trade_direction_ids)})
        )
      )`
    );
  }
  if (f.product_ids.length > 0) {
    parts.push(Prisma.sql`oi.product_id IN (${Prisma.join(f.product_ids)})`);
  }
  if (f.brand_ids.length > 0) {
    parts.push(Prisma.sql`p.brand_id IN (${Prisma.join(f.brand_ids)})`);
  }
  if (f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(
      Prisma.sql`(
        p.name ILIKE ${pat}
        OR p.sku ILIKE ${pat}
        OR COALESCE(NULLIF(btrim(c.region), ''), NULLIF(btrim(c.zone), ''), '') ILIKE ${pat}
      )`
    );
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }

  const whereSql = Prisma.join(parts, " AND ");

  return prisma.$queryRaw<P1AggCellRaw[]>`
    WITH ${STATUS_CTE},
    base AS (
      SELECT
        EXTRACT(YEAR FROM timezone('Asia/Tashkent', ${dateExpr}))::int AS y,
        EXTRACT(MONTH FROM timezone('Asia/Tashkent', ${dateExpr}))::int AS m,
        COALESCE(
          NULLIF(btrim(c.region), ''),
          NULLIF(btrim(c.zone), ''),
          'Без области'
        ) AS region_key,
        oi.product_id,
        p.name AS product_name,
        o.client_id,
        CASE
          WHEN o.status = 'returned' THEN -oi.qty
          WHEN o.order_type IN (${Prisma.join(returnTypes.map((t) => Prisma.sql`${t}`))}) THEN -oi.qty
          ELSE oi.qty
        END AS signed_qty,
        CASE
          WHEN o.status = 'returned' THEN -oi.total
          WHEN o.order_type IN (${Prisma.join(returnTypes.map((t) => Prisma.sql`${t}`))}) THEN -oi.total
          ELSE oi.total
        END AS signed_total
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      WHERE ${whereSql}
    )
    SELECT
      b.y AS year,
      b.m AS month,
      b.region_key,
      b.product_id,
      MAX(b.product_name) AS product_name,
      COUNT(DISTINCT b.client_id)::bigint AS akb,
      SUM(b.signed_qty)::numeric(18,3) AS qty,
      SUM(b.signed_total)::numeric(18,2) AS total
    FROM base b
    WHERE b.y IN (${f.year}, ${f.compare_year})
    GROUP BY b.y, b.m, b.region_key, b.product_id
    ORDER BY b.region_key ASC, MAX(b.product_name) ASC, b.y ASC, b.m ASC
  `;
}
