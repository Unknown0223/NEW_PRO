import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type {
  OutletClassBand,
  OutletClassReportFilters,
  OutletClassReportRow,
  OutletClassReportTotals
} from "./outlet-class-report.types";

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

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

function classCaseSql(bands: OutletClassBand[]): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const b of bands) {
    parts.push(Prisma.sql`WHEN s.sales_sum >= ${b.min_sum} THEN ${b.name}`);
  }
  return Prisma.sql`CASE ${Prisma.join(parts, " ")} ELSE ${bands.at(-1)?.name ?? "D"} END`;
}

type Raw = {
  class_name: string;
  client_id: number | null;
  client_name: string;
  agent_name: string;
  client_category: string;
  order_count: bigint;
  product_count: bigint;
  sales_sum: Prisma.Decimal;
  avg_check: Prisma.Decimal;
  total_count: bigint;
  sum_clients: bigint;
  sum_orders: bigint;
  sum_sales: Prisma.Decimal;
};

export async function getOutletClassReport(
  tenantId: number,
  f: OutletClassReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const offset = (f.page - 1) * f.limit;
  const classExpr = classCaseSql(f.bands);

  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (from) parts.push(Prisma.sql`o.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`o.created_at <= ${to}`);
  if (f.statuses.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  else parts.push(Prisma.sql`o.status <> 'cancelled'`);
  if (f.agent_ids.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.client_categories.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list.length) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list.length) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(
      Prisma.sql`(
        COALESCE(c.name, '') ILIKE ${pat}
        OR COALESCE(ag.name, '') ILIKE ${pat}
        OR COALESCE(c.phone, '') ILIKE ${pat}
      )`
    );
  }
  if (scopedActor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, scopedActor));
  }
  const whereSql = Prisma.join(parts, " AND ");

  let rows: Raw[];
  const clientSalesCte = Prisma.sql`
    orders_base AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        COALESCE(NULLIF(c.name, ''), '—') AS client_name,
        COALESCE(ag.name, '') AS agent_name,
        COALESCE(c.category, '') AS client_category,
        o.total_sum
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
      WHERE ${whereSql}
    ),
    products_by_client AS (
      SELECT ob.client_id, COUNT(DISTINCT oi.product_id)::bigint AS product_count
      FROM orders_base ob
      JOIN order_items oi ON oi.order_id = ob.order_id AND oi.is_bonus = false
      GROUP BY ob.client_id
    ),
    client_sales AS (
      SELECT
        ob.client_id,
        ob.client_name,
        ob.agent_name,
        ob.client_category,
        COUNT(*)::bigint AS order_count,
        COALESCE(MAX(p.product_count), 0)::bigint AS product_count,
        COALESCE(SUM(ob.total_sum), 0)::numeric(15,2) AS sales_sum
      FROM orders_base ob
      LEFT JOIN products_by_client p ON p.client_id = ob.client_id
      GROUP BY ob.client_id, ob.client_name, ob.agent_name, ob.client_category
    )
  `;

  if (f.group_by === "class") {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${clientSalesCte},
      scored AS (
        SELECT s.*, ${classExpr} AS class_name
        FROM client_sales s
      ),
      agg AS (
        SELECT
          class_name,
          NULL::int AS client_id,
          class_name AS client_name,
          ''::text AS agent_name,
          ''::text AS client_category,
          SUM(order_count)::bigint AS order_count,
          SUM(product_count)::bigint AS product_count,
          SUM(sales_sum)::numeric(15,2) AS sales_sum,
          CASE WHEN SUM(order_count) > 0
            THEN (SUM(sales_sum) / SUM(order_count))::numeric(15,2)
            ELSE 0::numeric(15,2)
          END AS avg_check
        FROM scored
        GROUP BY class_name
      ),
      totals AS (
        SELECT
          COUNT(*)::bigint AS sum_clients,
          COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
          COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales
        FROM scored
      )
      SELECT a.*, COUNT(*) OVER()::bigint AS total_count, t.*
      FROM agg a CROSS JOIN totals t
      ORDER BY a.sales_sum DESC, a.class_name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  } else {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${clientSalesCte},
      scored AS (
        SELECT
          s.*,
          ${classExpr} AS class_name,
          CASE WHEN s.order_count > 0
            THEN (s.sales_sum / s.order_count)::numeric(15,2)
            ELSE 0::numeric(15,2)
          END AS avg_check
        FROM client_sales s
      ),
      totals AS (
        SELECT
          COUNT(*)::bigint AS sum_clients,
          COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
          COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales
        FROM scored
      )
      SELECT
        sc.class_name,
        sc.client_id,
        sc.client_name,
        sc.agent_name,
        sc.client_category,
        sc.order_count,
        sc.product_count,
        sc.sales_sum,
        sc.avg_check,
        COUNT(*) OVER()::bigint AS total_count,
        t.sum_clients,
        t.sum_orders,
        t.sum_sales
      FROM scored sc CROSS JOIN totals t
      ORDER BY sc.sales_sum DESC, sc.client_name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  }

  const mapped: OutletClassReportRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    class_name: r.class_name ?? "",
    client_id: r.client_id,
    client_name: r.client_name ?? "",
    agent_name: r.agent_name ?? "",
    client_category: r.client_category ?? "",
    order_count: Number(r.order_count ?? 0),
    product_count: Number(r.product_count ?? 0),
    sales_sum: decStr(r.sales_sum),
    avg_check: decStr(r.avg_check)
  }));

  const totals: OutletClassReportTotals = {
    client_count: Number(rows[0]?.sum_clients ?? 0),
    order_count: Number(rows[0]?.sum_orders ?? 0),
    sales_sum: decStr(rows[0]?.sum_sales)
  };

  return {
    period_from: f.from,
    period_to: f.to,
    group_by: f.group_by,
    bands: f.bands,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals,
    rows: mapped
  };
}
