import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { VisitsReportFilters, VisitsReportRow, VisitsReportTotals } from "./visits-report.types";

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

function clientFilterSql(f: VisitsReportFilters, alias = "c"): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`${Prisma.raw(alias)}.merged_into_client_id IS NULL`];
  if (f.client_categories.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  return Prisma.join(parts, " AND ");
}

type Raw = {
  agent_id: number;
  agent_name: string;
  okb: bigint;
  akb: bigint;
  orders_count: bigint;
  sales_sum: Prisma.Decimal;
  refusals: bigint;
  photo_reports: bigint;
  visited: bigint;
  planned: bigint;
  visited_planned: bigint;
  total_count: bigint;
  sum_okb: bigint;
  sum_akb: bigint;
  sum_orders: bigint;
  sum_sales: Prisma.Decimal;
  sum_refusals: bigint;
  sum_photos: bigint;
  sum_visited: bigint;
  sum_planned: bigint;
  sum_visited_planned: bigint;
};

export async function getVisitsReport(
  tenantId: number,
  f: VisitsReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const offset = (f.page - 1) * f.limit;
  const clientSql = clientFilterSql(f);
  const wantPlanned = f.visit_kinds.length === 0 || f.visit_kinds.includes("planned");
  const wantUnplanned = f.visit_kinds.length === 0 || f.visit_kinds.includes("unplanned");

  const agentParts: Prisma.Sql[] = [
    Prisma.sql`u.tenant_id = ${tenantId}`,
    Prisma.sql`u.role = 'agent'`
  ];
  if (f.agent_ids.length) agentParts.push(Prisma.sql`u.id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length) {
    agentParts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    agentParts.push(
      Prisma.sql`(COALESCE(u.name, '') ILIKE ${pat} OR COALESCE(u.code, '') ILIKE ${pat})`
    );
  }
  if (scopedActor) {
    agentParts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`u.id`, scopedActor));
  }
  const agentWhere = Prisma.join(agentParts, " AND ");

  const orderStatusSql = f.statuses.length
    ? Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`
    : Prisma.sql`o.status <> 'cancelled'`;

  const dateVisitFrom = from ? Prisma.sql`AND av.checked_in_at >= ${from}` : Prisma.empty;
  const dateVisitTo = to ? Prisma.sql`AND av.checked_in_at <= ${to}` : Prisma.empty;
  const dateOrderFrom = from ? Prisma.sql`AND o.created_at >= ${from}` : Prisma.empty;
  const dateOrderTo = to ? Prisma.sql`AND o.created_at <= ${to}` : Prisma.empty;
  const dateRefusalFrom = from ? Prisma.sql`AND cr.created_at >= ${from}` : Prisma.empty;
  const dateRefusalTo = to ? Prisma.sql`AND cr.created_at <= ${to}` : Prisma.empty;
  const datePhotoFrom = from ? Prisma.sql`AND pr.created_at >= ${from}` : Prisma.empty;
  const datePhotoTo = to ? Prisma.sql`AND pr.created_at <= ${to}` : Prisma.empty;
  const visitKindFilter = (() => {
    if (wantPlanned && wantUnplanned) return Prisma.empty;
    if (wantPlanned && !wantUnplanned) {
      return Prisma.sql`AND EXISTS (
        SELECT 1 FROM planned p
        WHERE p.agent_id = v.agent_id AND p.client_id = v.client_id
      )`;
    }
    if (!wantPlanned && wantUnplanned) {
      return Prisma.sql`AND NOT EXISTS (
        SELECT 1 FROM planned p
        WHERE p.agent_id = v.agent_id AND p.client_id = v.client_id
      )`;
    }
    return Prisma.sql`AND FALSE`;
  })();

  const planDateSql =
    from && to
      ? Prisma.sql`(caa.visit_date IS NOT NULL AND caa.visit_date >= ${from} AND caa.visit_date <= ${to})`
      : Prisma.sql`(caa.visit_date IS NOT NULL)`;

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH agents AS (
      SELECT u.id AS agent_id, COALESCE(NULLIF(u.name, ''), '—') AS agent_name
      FROM users u
      WHERE ${agentWhere}
    ),
    planned AS (
      SELECT DISTINCT caa.agent_id, caa.client_id
      FROM client_agent_assignments caa
      JOIN agents a ON a.agent_id = caa.agent_id
      JOIN clients c ON c.id = caa.client_id AND c.tenant_id = caa.tenant_id
      WHERE caa.tenant_id = ${tenantId}
        AND caa.agent_id IS NOT NULL
        AND ${clientSql}
        AND (
          (caa.visit_date IS NULL AND jsonb_array_length(COALESCE(caa.visit_weekdays::jsonb, '[]'::jsonb)) > 0)
          OR ${planDateSql}
        )
    ),
    okb_agg AS (
      SELECT caa.agent_id, COUNT(DISTINCT caa.client_id)::bigint AS okb
      FROM client_agent_assignments caa
      JOIN agents a ON a.agent_id = caa.agent_id
      JOIN clients c ON c.id = caa.client_id AND c.tenant_id = caa.tenant_id
      WHERE caa.tenant_id = ${tenantId}
        AND caa.agent_id IS NOT NULL
        AND ${clientSql}
      GROUP BY caa.agent_id
    ),
    visits_raw AS (
      SELECT DISTINCT av.agent_id, av.client_id
      FROM agent_visits av
      JOIN agents a ON a.agent_id = av.agent_id
      LEFT JOIN clients c ON c.id = av.client_id AND c.tenant_id = av.tenant_id
      WHERE av.tenant_id = ${tenantId}
        AND av.client_id IS NOT NULL
        ${dateVisitFrom}
        ${dateVisitTo}
        AND (c.id IS NULL OR (${clientSql}))
    ),
    visits AS (
      SELECT v.agent_id, v.client_id
      FROM visits_raw v
      WHERE TRUE
        ${visitKindFilter}
    ),
    orders_agg AS (
      SELECT o.agent_id,
             COUNT(*)::bigint AS orders_count,
             COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN agents a ON a.agent_id = o.agent_id
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND ${orderStatusSql}
        ${dateOrderFrom}
        ${dateOrderTo}
        AND ${clientSql}
      GROUP BY o.agent_id
    ),
    refusals_agg AS (
      SELECT cr.agent_id, COUNT(*)::bigint AS refusals
      FROM client_refusals cr
      JOIN agents a ON a.agent_id = cr.agent_id
      JOIN clients c ON c.id = cr.client_id AND c.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = ${tenantId}
        ${dateRefusalFrom}
        ${dateRefusalTo}
        AND ${clientSql}
      GROUP BY cr.agent_id
    ),
    photos_agg AS (
      SELECT pr.created_by_user_id AS agent_id, COUNT(*)::bigint AS photo_reports
      FROM client_photo_reports pr
      JOIN agents a ON a.agent_id = pr.created_by_user_id
      JOIN clients c ON c.id = pr.client_id AND c.tenant_id = pr.tenant_id
      WHERE pr.tenant_id = ${tenantId}
        AND pr.deleted_at IS NULL
        AND pr.created_by_user_id IS NOT NULL
        ${datePhotoFrom}
        ${datePhotoTo}
        AND ${clientSql}
      GROUP BY pr.created_by_user_id
    ),
    visit_agg AS (
      SELECT agent_id,
             COUNT(*)::bigint AS visited,
             COUNT(DISTINCT client_id)::bigint AS akb
      FROM visits
      GROUP BY agent_id
    ),
    planned_agg AS (
      SELECT agent_id, COUNT(*)::bigint AS planned
      FROM planned
      GROUP BY agent_id
    ),
    visited_planned_agg AS (
      SELECT v.agent_id, COUNT(*)::bigint AS visited_planned
      FROM visits v
      JOIN planned p ON p.agent_id = v.agent_id AND p.client_id = v.client_id
      GROUP BY v.agent_id
    ),
    keys AS (
      SELECT agent_id FROM visit_agg
      UNION SELECT agent_id FROM orders_agg
      UNION SELECT agent_id FROM refusals_agg
      UNION SELECT agent_id FROM photos_agg
      UNION SELECT agent_id FROM planned_agg
    ),
    agg AS (
      SELECT
        a.agent_id,
        a.agent_name,
        COALESCE(ok.okb, 0)::bigint AS okb,
        COALESCE(va.akb, 0)::bigint AS akb,
        COALESCE(oa.orders_count, 0)::bigint AS orders_count,
        COALESCE(oa.sales_sum, 0)::numeric(15,2) AS sales_sum,
        COALESCE(ra.refusals, 0)::bigint AS refusals,
        COALESCE(ph.photo_reports, 0)::bigint AS photo_reports,
        COALESCE(va.visited, 0)::bigint AS visited,
        COALESCE(pa.planned, 0)::bigint AS planned,
        COALESCE(vp.visited_planned, 0)::bigint AS visited_planned
      FROM keys k
      JOIN agents a ON a.agent_id = k.agent_id
      LEFT JOIN okb_agg ok ON ok.agent_id = k.agent_id
      LEFT JOIN visit_agg va ON va.agent_id = k.agent_id
      LEFT JOIN orders_agg oa ON oa.agent_id = k.agent_id
      LEFT JOIN refusals_agg ra ON ra.agent_id = k.agent_id
      LEFT JOIN photos_agg ph ON ph.agent_id = k.agent_id
      LEFT JOIN planned_agg pa ON pa.agent_id = k.agent_id
      LEFT JOIN visited_planned_agg vp ON vp.agent_id = k.agent_id
    ),
    totals AS (
      SELECT
        COALESCE(SUM(okb), 0)::bigint AS sum_okb,
        COALESCE(SUM(akb), 0)::bigint AS sum_akb,
        COALESCE(SUM(orders_count), 0)::bigint AS sum_orders,
        COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales,
        COALESCE(SUM(refusals), 0)::bigint AS sum_refusals,
        COALESCE(SUM(photo_reports), 0)::bigint AS sum_photos,
        COALESCE(SUM(visited), 0)::bigint AS sum_visited,
        COALESCE(SUM(planned), 0)::bigint AS sum_planned,
        COALESCE(SUM(visited_planned), 0)::bigint AS sum_visited_planned
      FROM agg
    )
    SELECT g.*, COUNT(*) OVER()::bigint AS total_count, t.*
    FROM agg g CROSS JOIN totals t
    ORDER BY g.visited DESC, g.agent_name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: VisitsReportRow[] = rows.map((r, idx) => {
    const planned = Number(r.planned ?? 0);
    const visitedPlanned = Number(r.visited_planned ?? 0);
    const notVisited = Math.max(planned - visitedPlanned, 0);
    return {
      row_number: offset + idx + 1,
      agent_id: r.agent_id,
      agent_name: r.agent_name ?? "",
      okb: Number(r.okb ?? 0),
      akb: Number(r.akb ?? 0),
      orders_count: Number(r.orders_count ?? 0),
      sales_sum: decStr(r.sales_sum),
      refusals: Number(r.refusals ?? 0),
      photo_reports: Number(r.photo_reports ?? 0),
      visited: Number(r.visited ?? 0),
      not_visited: notVisited,
      planned,
      visit_pct: planned > 0 ? Math.round((visitedPlanned / planned) * 1000) / 10 : 0
    };
  });

  const t0 = rows[0];
  const sumPlanned = Number(t0?.sum_planned ?? 0);
  const sumVisitedPlanned = Number(t0?.sum_visited_planned ?? 0);
  const totals: VisitsReportTotals = {
    okb: Number(t0?.sum_okb ?? 0),
    akb: Number(t0?.sum_akb ?? 0),
    orders_count: Number(t0?.sum_orders ?? 0),
    sales_sum: decStr(t0?.sum_sales),
    refusals: Number(t0?.sum_refusals ?? 0),
    photo_reports: Number(t0?.sum_photos ?? 0),
    visited: Number(t0?.sum_visited ?? 0),
    not_visited: Math.max(sumPlanned - sumVisitedPlanned, 0),
    planned: sumPlanned
  };

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(t0?.total_count ?? 0),
    totals,
    rows: mapped
  };
}
