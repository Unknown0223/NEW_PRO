import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { RfmReportFilters, RfmReportRow, RfmReportTotals } from "./rfm-report.types";

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

function ymdFromDate(v: Date | null): string {
  if (!v) return "";
  return v.toISOString().slice(0, 10);
}

type Raw = {
  client_id: number;
  client_name: string;
  agent_name: string;
  client_category: string;
  last_order_at: Date;
  last_order_days: number;
  order_count: bigint;
  sales_sum: Prisma.Decimal;
  avg_check: Prisma.Decimal;
  r_score: number;
  f_score: number;
  m_score: number;
  rfm_label: string;
  total_count: bigint;
  sum_clients: bigint;
  sum_orders: bigint;
  sum_sales: Prisma.Decimal;
};

export async function getRfmReport(tenantId: number, f: RfmReportFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const toYmd = f.to.trim();
  const offset = (f.page - 1) * f.limit;

  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`o.status <> 'cancelled'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (from) parts.push(Prisma.sql`o.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`o.created_at <= ${to}`);
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

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH client_sales AS (
      SELECT
        c.id AS client_id,
        COALESCE(NULLIF(c.name, ''), '—') AS client_name,
        COALESCE(ag.name, '') AS agent_name,
        COALESCE(c.category, '') AS client_category,
        MAX(o.created_at) AS last_order_at,
        GREATEST(
          0,
          (${toYmd}::date - (MAX(o.created_at AT TIME ZONE 'UTC')::date))
        )::int AS last_order_days,
        COUNT(*)::bigint AS order_count,
        COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      LEFT JOIN users ag ON ag.id = c.agent_id AND ag.tenant_id = c.tenant_id
      WHERE ${whereSql}
      GROUP BY c.id, c.name, ag.name, c.category
    ),
    scored AS (
      SELECT
        s.*,
        CASE WHEN s.order_count > 0
          THEN (s.sales_sum / s.order_count)::numeric(15,2)
          ELSE 0::numeric(15,2)
        END AS avg_check,
        NTILE(5) OVER (ORDER BY s.last_order_days DESC)::int AS r_score,
        NTILE(5) OVER (ORDER BY s.order_count ASC)::int AS f_score,
        NTILE(5) OVER (ORDER BY s.sales_sum ASC)::int AS m_score
      FROM client_sales s
    ),
    labeled AS (
      SELECT
        sc.*,
        (sc.r_score::text || '-' || sc.f_score::text || '-' || sc.m_score::text) AS rfm_label
      FROM scored sc
    ),
    totals AS (
      SELECT
        COUNT(*)::bigint AS sum_clients,
        COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
        COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales
      FROM labeled
    )
    SELECT
      l.client_id,
      l.client_name,
      l.agent_name,
      l.client_category,
      l.last_order_at,
      l.last_order_days,
      l.order_count,
      l.sales_sum,
      l.avg_check,
      l.r_score,
      l.f_score,
      l.m_score,
      l.rfm_label,
      COUNT(*) OVER()::bigint AS total_count,
      t.sum_clients,
      t.sum_orders,
      t.sum_sales
    FROM labeled l CROSS JOIN totals t
    ORDER BY l.sales_sum DESC, l.client_name ASC, l.client_id ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: RfmReportRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    client_id: r.client_id,
    client_name: r.client_name ?? "",
    agent_name: r.agent_name ?? "",
    client_category: r.client_category ?? "",
    last_order_at: ymdFromDate(r.last_order_at),
    last_order_days: Number(r.last_order_days ?? 0),
    order_count: Number(r.order_count ?? 0),
    sales_sum: decStr(r.sales_sum),
    avg_check: decStr(r.avg_check),
    r_score: Number(r.r_score ?? 1),
    f_score: Number(r.f_score ?? 1),
    m_score: Number(r.m_score ?? 1),
    rfm_label: r.rfm_label ?? "1-1-1"
  }));

  const totals: RfmReportTotals = {
    client_count: Number(rows[0]?.sum_clients ?? 0),
    order_count: Number(rows[0]?.sum_orders ?? 0),
    sales_sum: decStr(rows[0]?.sum_sales)
  };

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals,
    rows: mapped
  };
}