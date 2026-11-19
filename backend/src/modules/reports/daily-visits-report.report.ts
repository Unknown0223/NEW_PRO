import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { DailyVisitsReportFilters, DailyVisitsReportRow, DailyVisitsReportTotals } from "./daily-visits-report.types";

function parseDateStart(v: string): Date {
  const d = new Date(`${v}T00:00:00.000Z`);
  return d;
}

function parseDateEndExclusive(v: string): Date {
  const d = new Date(`${v}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

type Raw = {
  work_date: Date;
  agent_id: number;
  agent_name: string;
  visited: bigint;
  planned: bigint;
  visited_planned: bigint;
  orders_count: bigint;
  photo_reports: bigint;
  refusals: bigint;
  total_count: bigint;
  sum_visited: bigint;
  sum_planned: bigint;
  sum_visited_planned: bigint;
  sum_orders: bigint;
  sum_photos: bigint;
  sum_refusals: bigint;
};

export async function getDailyVisitsReport(
  tenantId: number,
  f: DailyVisitsReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const rangeStart = parseDateStart(f.from);
  const rangeEnd = parseDateEndExclusive(f.to);
  const offset = (f.page - 1) * f.limit;

  const agentParts: Prisma.Sql[] = [
    Prisma.sql`u.tenant_id = ${tenantId}`,
    Prisma.sql`u.role = 'agent'`
  ];
  if (f.agent_ids.length) agentParts.push(Prisma.sql`u.id IN (${Prisma.join(f.agent_ids)})`);
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

  const wantPlanned = f.visit_kinds.length === 0 || f.visit_kinds.includes("planned");
  const wantUnplanned = f.visit_kinds.length === 0 || f.visit_kinds.includes("unplanned");
  const visitKindFilter = (() => {
    if (wantPlanned && wantUnplanned) return Prisma.empty;
    if (wantPlanned && !wantUnplanned) {
      return Prisma.sql`AND EXISTS (
        SELECT 1 FROM planned_pairs pp
        WHERE pp.agent_id = v.agent_id AND pp.client_id = v.client_id AND pp.day = v.day
      )`;
    }
    if (!wantPlanned && wantUnplanned) {
      return Prisma.sql`AND NOT EXISTS (
        SELECT 1 FROM planned_pairs pp
        WHERE pp.agent_id = v.agent_id AND pp.client_id = v.client_id AND pp.day = v.day
      )`;
    }
    return Prisma.sql`AND FALSE`;
  })();

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH days AS (
      SELECT (gs AT TIME ZONE 'UTC')::date AS day
      FROM generate_series(${rangeStart}::timestamptz, ${rangeEnd}::timestamptz - interval '1 day', interval '1 day') AS gs
    ),
    agents AS (
      SELECT u.id AS agent_id, COALESCE(NULLIF(u.name, ''), '—') AS agent_name
      FROM users u
      WHERE ${agentWhere}
    ),
    planned_pairs AS (
      SELECT DISTINCT a.agent_id, d.day, caa.client_id
      FROM days d
      CROSS JOIN agents a
      JOIN client_agent_assignments caa
        ON caa.tenant_id = ${tenantId}
       AND caa.agent_id = a.agent_id
      JOIN clients c ON c.id = caa.client_id AND c.tenant_id = caa.tenant_id
      WHERE c.merged_into_client_id IS NULL
        AND (
          (caa.visit_date IS NOT NULL AND (caa.visit_date AT TIME ZONE 'UTC')::date = d.day)
          OR (
            caa.visit_date IS NULL
            AND caa.visit_weekdays::jsonb @> to_jsonb(EXTRACT(ISODOW FROM d.day)::int)
          )
        )
    ),
    visits_raw AS (
      SELECT DISTINCT
        av.agent_id,
        (av.checked_in_at AT TIME ZONE 'UTC')::date AS day,
        av.client_id
      FROM agent_visits av
      JOIN agents a ON a.agent_id = av.agent_id
      WHERE av.tenant_id = ${tenantId}
        AND av.client_id IS NOT NULL
        AND av.checked_in_at >= ${rangeStart}
        AND av.checked_in_at < ${rangeEnd}
    ),
    visits AS (
      SELECT v.agent_id, v.day, v.client_id
      FROM visits_raw v
      WHERE TRUE
        ${visitKindFilter}
    ),
    orders_agg AS (
      SELECT
        o.agent_id,
        (o.created_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*)::bigint AS orders_count
      FROM orders o
      JOIN agents a ON a.agent_id = o.agent_id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status <> 'cancelled'
        AND o.created_at >= ${rangeStart}
        AND o.created_at < ${rangeEnd}
      GROUP BY o.agent_id, (o.created_at AT TIME ZONE 'UTC')::date
    ),
    photos_agg AS (
      SELECT
        pr.created_by_user_id AS agent_id,
        (pr.created_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*)::bigint AS photo_reports
      FROM client_photo_reports pr
      JOIN agents a ON a.agent_id = pr.created_by_user_id
      WHERE pr.tenant_id = ${tenantId}
        AND pr.deleted_at IS NULL
        AND pr.created_by_user_id IS NOT NULL
        AND pr.created_at >= ${rangeStart}
        AND pr.created_at < ${rangeEnd}
      GROUP BY pr.created_by_user_id, (pr.created_at AT TIME ZONE 'UTC')::date
    ),
    refusals_agg AS (
      SELECT
        cr.agent_id,
        (cr.created_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*)::bigint AS refusals
      FROM client_refusals cr
      JOIN agents a ON a.agent_id = cr.agent_id
      WHERE cr.tenant_id = ${tenantId}
        AND cr.created_at >= ${rangeStart}
        AND cr.created_at < ${rangeEnd}
      GROUP BY cr.agent_id, (cr.created_at AT TIME ZONE 'UTC')::date
    ),
    visit_agg AS (
      SELECT agent_id, day, COUNT(*)::bigint AS visited
      FROM visits
      GROUP BY agent_id, day
    ),
    planned_agg AS (
      SELECT agent_id, day, COUNT(*)::bigint AS planned
      FROM planned_pairs
      GROUP BY agent_id, day
    ),
    visited_planned_agg AS (
      SELECT v.agent_id, v.day, COUNT(*)::bigint AS visited_planned
      FROM visits v
      JOIN planned_pairs pp
        ON pp.agent_id = v.agent_id AND pp.client_id = v.client_id AND pp.day = v.day
      GROUP BY v.agent_id, v.day
    ),
    keys AS (
      SELECT agent_id, day FROM visit_agg
      UNION SELECT agent_id, day FROM planned_agg
      UNION SELECT agent_id, day FROM orders_agg
      UNION SELECT agent_id, day FROM photos_agg
      UNION SELECT agent_id, day FROM refusals_agg
    ),
    agg AS (
      SELECT
        k.day AS work_date,
        a.agent_id,
        a.agent_name,
        COALESCE(va.visited, 0)::bigint AS visited,
        COALESCE(pa.planned, 0)::bigint AS planned,
        COALESCE(vp.visited_planned, 0)::bigint AS visited_planned,
        COALESCE(oa.orders_count, 0)::bigint AS orders_count,
        COALESCE(ph.photo_reports, 0)::bigint AS photo_reports,
        COALESCE(ra.refusals, 0)::bigint AS refusals
      FROM keys k
      JOIN agents a ON a.agent_id = k.agent_id
      LEFT JOIN visit_agg va ON va.agent_id = k.agent_id AND va.day = k.day
      LEFT JOIN planned_agg pa ON pa.agent_id = k.agent_id AND pa.day = k.day
      LEFT JOIN visited_planned_agg vp ON vp.agent_id = k.agent_id AND vp.day = k.day
      LEFT JOIN orders_agg oa ON oa.agent_id = k.agent_id AND oa.day = k.day
      LEFT JOIN photos_agg ph ON ph.agent_id = k.agent_id AND ph.day = k.day
      LEFT JOIN refusals_agg ra ON ra.agent_id = k.agent_id AND ra.day = k.day
    ),
    totals AS (
      SELECT
        COALESCE(SUM(visited), 0)::bigint AS sum_visited,
        COALESCE(SUM(planned), 0)::bigint AS sum_planned,
        COALESCE(SUM(visited_planned), 0)::bigint AS sum_visited_planned,
        COALESCE(SUM(orders_count), 0)::bigint AS sum_orders,
        COALESCE(SUM(photo_reports), 0)::bigint AS sum_photos,
        COALESCE(SUM(refusals), 0)::bigint AS sum_refusals
      FROM agg
    )
    SELECT g.*, COUNT(*) OVER()::bigint AS total_count, t.*
    FROM agg g CROSS JOIN totals t
    ORDER BY g.work_date ASC, g.agent_name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: DailyVisitsReportRow[] = rows.map((r, idx) => {
    const planned = Number(r.planned ?? 0);
    const visitedPlanned = Number(r.visited_planned ?? 0);
    const day =
      r.work_date instanceof Date
        ? r.work_date.toISOString().slice(0, 10)
        : String(r.work_date).slice(0, 10);
    return {
      row_number: offset + idx + 1,
      work_date: day,
      agent_id: r.agent_id,
      agent_name: r.agent_name ?? "",
      visited: Number(r.visited ?? 0),
      planned,
      not_visited: Math.max(planned - visitedPlanned, 0),
      orders_count: Number(r.orders_count ?? 0),
      photo_reports: Number(r.photo_reports ?? 0),
      refusals: Number(r.refusals ?? 0),
      visit_pct: planned > 0 ? Math.round((visitedPlanned / planned) * 1000) / 10 : 0
    };
  });

  const t0 = rows[0];
  const sumPlanned = Number(t0?.sum_planned ?? 0);
  const sumVisitedPlanned = Number(t0?.sum_visited_planned ?? 0);
  const totals: DailyVisitsReportTotals = {
    visited: Number(t0?.sum_visited ?? 0),
    planned: sumPlanned,
    not_visited: Math.max(sumPlanned - sumVisitedPlanned, 0),
    orders_count: Number(t0?.sum_orders ?? 0),
    photo_reports: Number(t0?.sum_photos ?? 0),
    refusals: Number(t0?.sum_refusals ?? 0)
  };

  return {
    year: f.year,
    month: f.month,
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(t0?.total_count ?? 0),
    totals,
    rows: mapped
  };
}
