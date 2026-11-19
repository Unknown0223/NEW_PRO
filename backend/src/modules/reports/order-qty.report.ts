import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { OrderQtyFilters, OrderQtyRow } from "./order-qty.types";

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

function buildOrderWhere(tenantId: number, f: OrderQtyFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type IN ('order', 'return', 'return_by_order', 'exchange')`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  if (from) parts.push(Prisma.sql`o.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`o.created_at <= ${to}`);
  if (f.statuses?.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  if (f.agent_ids?.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.client_categories?.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list?.length) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list?.length) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list?.length) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  if (f.category_ids?.length) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM order_items oi
        JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
        WHERE oi.order_id = o.id AND p.category_id IN (${Prisma.join(f.category_ids)})
      )`
    );
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(
      Prisma.sql`(c.name ILIKE ${pat} OR COALESCE(c.phone, '') ILIKE ${pat} OR COALESCE(ag.name, '') ILIKE ${pat})`
    );
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

export async function getOrderQtyReport(tenantId: number, f: OrderQtyFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildOrderWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  type Raw = {
    client_id: number;
    client_name: string;
    phone: string | null;
    agent_name: string | null;
    order_count: bigint;
    return_count: bigint;
    exchange_count: bigint;
    total_count: bigint;
    sum_orders: bigint;
    sum_returns: bigint;
    sum_exchanges: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH base AS (
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        COALESCE(c.phone, '') AS phone,
        COALESCE(ag.name, '') AS agent_name,
        COUNT(*) FILTER (WHERE o.order_type = 'order')::bigint AS order_count,
        COUNT(*) FILTER (WHERE o.order_type IN ('return', 'return_by_order'))::bigint AS return_count,
        COUNT(*) FILTER (WHERE o.order_type = 'exchange')::bigint AS exchange_count
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN users ag ON ag.id = COALESCE(c.agent_id, o.agent_id)
      WHERE ${whereSql}
      GROUP BY c.id, c.name, c.phone, ag.name
      HAVING (
        COUNT(*) FILTER (WHERE o.order_type = 'order')
        + COUNT(*) FILTER (WHERE o.order_type IN ('return', 'return_by_order'))
        + COUNT(*) FILTER (WHERE o.order_type = 'exchange')
      ) > 0
    )
    SELECT
      b.*,
      COUNT(*) OVER()::bigint AS total_count,
      COALESCE(SUM(b.order_count) OVER(), 0)::bigint AS sum_orders,
      COALESCE(SUM(b.return_count) OVER(), 0)::bigint AS sum_returns,
      COALESCE(SUM(b.exchange_count) OVER(), 0)::bigint AS sum_exchanges
    FROM base b
    ORDER BY (b.order_count + b.return_count + b.exchange_count) DESC, b.client_name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: OrderQtyRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    client_id: r.client_id,
    client_name: r.client_name,
    phone: r.phone ?? "",
    agent_name: r.agent_name ?? "",
    order_count: Number(r.order_count),
    return_count: Number(r.return_count),
    exchange_count: Number(r.exchange_count)
  }));

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals: {
      order_count: Number(rows[0]?.sum_orders ?? 0),
      return_count: Number(rows[0]?.sum_returns ?? 0),
      exchange_count: Number(rows[0]?.sum_exchanges ?? 0)
    },
    rows: mapped
  };
}
