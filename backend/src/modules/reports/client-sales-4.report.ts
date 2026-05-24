import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientSales4Filters, ReportActor } from "./client-sales-4.types";
import { cteBody } from "./client-sales-4.core";

const ITEM_FILTER_LATERAL = (itemSql: Prisma.Sql, hasItemFilter: boolean) => Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(oi.total), 0)::numeric(15,2) AS item_amount,
      COUNT(*)::int AS item_count
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = o.id
    ${itemSql}
  ) it ON true
`;

const FILTERED_ORDERS_CTE = (
  whereSql: Prisma.Sql,
  itemSql: Prisma.Sql,
  hasItemFilter: boolean
) => Prisma.sql`
  filtered_orders AS (
    SELECT
      o.id AS order_id,
      o.client_id,
      COALESCE(o.agent_id, c.agent_id) AS agent_id,
      c.name AS client_name,
      c.zone,
      c.region,
      c.city,
      COALESCE(it.item_amount, 0)::numeric(15,2) AS amount
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    ${ITEM_FILTER_LATERAL(itemSql, hasItemFilter)}
    WHERE ${whereSql}
      ${hasItemFilter ? Prisma.sql`AND COALESCE(it.item_count, 0) > 0` : Prisma.empty}
  )
`;

export async function getClientSales4Report(tenantId: number, f: ClientSales4Filters, actor?: ReportActor) {
  const { whereSql, itemSql, hasItemFilter, clientHaving } = cteBody(f, tenantId, actor);
  const offset = (f.page - 1) * f.limit;

  const listRows = await prisma.$queryRaw<
    Array<{
      client_id: number;
      client_name: string;
      agent_name: string | null;
      agent_code: string | null;
      territory: string | null;
      amount: Prisma.Decimal;
    }>
  >`
    WITH ${FILTERED_ORDERS_CTE(whereSql, itemSql, hasItemFilter)},
    client_agg AS (
      SELECT
        fo.client_id,
        MAX(fo.client_name) AS client_name,
        COALESCE(SUM(fo.amount), 0)::numeric(15,2) AS amount,
        MAX(u.name) AS agent_name,
        MAX(u.code) AS agent_code,
        CONCAT_WS(' / ', NULLIF(MAX(fo.zone), ''), NULLIF(MAX(fo.region), ''), NULLIF(MAX(fo.city), '')) AS territory
      FROM filtered_orders fo
      LEFT JOIN users u ON u.id = fo.agent_id
      GROUP BY fo.client_id
      ${clientHaving}
    )
    SELECT *
    FROM client_agg
    ORDER BY amount DESC NULLS LAST, client_id DESC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const statsRows = await prisma.$queryRaw<
    Array<{ total: bigint; akb: bigint; total_amount: Prisma.Decimal }>
  >`
    WITH ${FILTERED_ORDERS_CTE(whereSql, itemSql, hasItemFilter)},
    client_agg AS (
      SELECT
        fo.client_id,
        COALESCE(SUM(fo.amount), 0)::numeric(15,2) AS amount
      FROM filtered_orders fo
      GROUP BY fo.client_id
      ${clientHaving}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE amount > 0)::bigint AS akb,
      COALESCE(SUM(amount), 0)::numeric(15,2) AS total_amount
    FROM client_agg
  `;

  const row = statsRows[0] ?? { total: 0n, akb: 0n, total_amount: new Prisma.Decimal(0) };

  return {
    period_from: f.from,
    period_to: f.to,
    akb: Number(row.akb ?? 0n),
    total_amount: row.total_amount.toString(),
    clients: listRows.map((r) => ({
      client_id: r.client_id,
      client_name: r.client_name,
      agent_name: r.agent_name ?? "—",
      agent_code: r.agent_code ?? "",
      territory: r.territory ?? "—",
      amount: r.amount.toString()
    })),
    page: f.page,
    limit: f.limit,
    total: Number(row.total ?? 0n)
  };
}
