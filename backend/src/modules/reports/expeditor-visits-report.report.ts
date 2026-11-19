import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import { actorHasUnrestrictedDataScope, uniquePositiveIds } from "../access/access-staff-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type {
  ExpeditorVisitsReportFilters,
  ExpeditorVisitsReportRow,
  ExpeditorVisitsReportTotals
} from "./expeditor-visits-report.types";

function parseDateStart(v: string): Date {
  return new Date(`${v}T00:00:00.000Z`);
}

function parseDateEndExclusive(v: string): Date {
  const d = new Date(`${v}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

function expeditorScopeSql(actor: Awaited<ReturnType<typeof enrichScopedReportActor>> | undefined): Prisma.Sql {
  if (!actor?.userId) return Prisma.sql`TRUE`;
  if (actor.role === "expeditor") {
    return Prisma.sql`u.id = ${actor.userId}`;
  }
  if (actorHasUnrestrictedDataScope(actor.role)) return Prisma.sql`TRUE`;
  const bound = uniquePositiveIds(actor.bound_staff_ids ?? actor.bound_agent_ids ?? []);
  if (bound.length > 0) return Prisma.sql`u.id IN (${Prisma.join(bound)})`;
  return Prisma.sql`FALSE`;
}

type Raw = {
  expeditor_id: number;
  expeditor_name: string;
  planned: bigint;
  visited: bigint;
  visited_planned: bigint;
  order_count: bigint;
  defect_count: bigint;
  payment_sum: Prisma.Decimal;
  total_count: bigint;
  sum_planned: bigint;
  sum_visited: bigint;
  sum_visited_planned: bigint;
  sum_orders: bigint;
  sum_defects: bigint;
  sum_payments: Prisma.Decimal;
};

export async function getExpeditorVisitsReport(
  tenantId: number,
  f: ExpeditorVisitsReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const rangeStart = parseDateStart(f.from);
  const rangeEnd = parseDateEndExclusive(f.to);
  const offset = (f.page - 1) * f.limit;

  const expParts: Prisma.Sql[] = [
    Prisma.sql`u.tenant_id = ${tenantId}`,
    Prisma.sql`u.role = 'expeditor'`,
    Prisma.sql`u.is_active = true`,
    expeditorScopeSql(scopedActor)
  ];
  if (f.expeditor_ids.length) {
    expParts.push(Prisma.sql`u.id IN (${Prisma.join(f.expeditor_ids)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    expParts.push(
      Prisma.sql`(COALESCE(u.name, '') ILIKE ${pat} OR COALESCE(u.code, '') ILIKE ${pat})`
    );
  }
  const expWhere = Prisma.join(expParts, " AND ");

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH days AS (
      SELECT (gs AT TIME ZONE 'UTC')::date AS day
      FROM generate_series(${rangeStart}::timestamptz, ${rangeEnd}::timestamptz - interval '1 day', interval '1 day') AS gs
    ),
    expeditors AS (
      SELECT u.id AS expeditor_id, COALESCE(NULLIF(u.name, ''), '—') AS expeditor_name
      FROM users u
      WHERE ${expWhere}
    ),
    planned_pairs AS (
      SELECT DISTINCT e.expeditor_id, d.day, caa.client_id
      FROM days d
      CROSS JOIN expeditors e
      JOIN client_agent_assignments caa
        ON caa.tenant_id = ${tenantId}
       AND caa.expeditor_user_id = e.expeditor_id
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
    visit_pairs AS (
      SELECT DISTINCT
        o.expeditor_user_id AS expeditor_id,
        (sl.created_at AT TIME ZONE 'UTC')::date AS day,
        o.client_id
      FROM orders o
      JOIN expeditors e ON e.expeditor_id = o.expeditor_user_id
      JOIN order_status_logs sl ON sl.order_id = o.id
        AND sl.to_status IN ('picking', 'delivering', 'delivered', 'returned')
      WHERE o.tenant_id = ${tenantId}
        AND o.expeditor_user_id IS NOT NULL
        AND o.status <> 'cancelled'
        AND sl.created_at >= ${rangeStart}
        AND sl.created_at < ${rangeEnd}
    ),
    orders_agg AS (
      SELECT
        o.expeditor_user_id AS expeditor_id,
        COUNT(*) FILTER (WHERE o.order_type = 'order')::bigint AS order_count,
        COUNT(*) FILTER (
          WHERE o.status = 'returned'
             OR o.order_type IN ('return', 'return_by_order')
        )::bigint AS defect_count
      FROM orders o
      JOIN expeditors e ON e.expeditor_id = o.expeditor_user_id
      WHERE o.tenant_id = ${tenantId}
        AND o.expeditor_user_id IS NOT NULL
        AND o.status <> 'cancelled'
        AND o.created_at >= ${rangeStart}
        AND o.created_at < ${rangeEnd}
      GROUP BY o.expeditor_user_id
    ),
    payments_agg AS (
      SELECT
        p.expeditor_user_id AS expeditor_id,
        COALESCE(SUM(p.amount), 0)::numeric(15,2) AS payment_sum
      FROM payments p
      JOIN expeditors e ON e.expeditor_id = p.expeditor_user_id
      WHERE p.tenant_id = ${tenantId}
        AND p.expeditor_user_id IS NOT NULL
        AND p.deleted_at IS NULL
        AND p.workflow_status <> 'deleted'
        AND p.created_at >= ${rangeStart}
        AND p.created_at < ${rangeEnd}
      GROUP BY p.expeditor_user_id
    ),
    planned_agg AS (
      SELECT expeditor_id, COUNT(*)::bigint AS planned
      FROM planned_pairs
      GROUP BY expeditor_id
    ),
    visited_agg AS (
      SELECT expeditor_id, COUNT(*)::bigint AS visited
      FROM visit_pairs
      GROUP BY expeditor_id
    ),
    visited_planned_agg AS (
      SELECT pp.expeditor_id, COUNT(*)::bigint AS visited_planned
      FROM planned_pairs pp
      JOIN visit_pairs vp
        ON vp.expeditor_id = pp.expeditor_id
       AND vp.day = pp.day
       AND vp.client_id = pp.client_id
      GROUP BY pp.expeditor_id
    ),
    scored AS (
      SELECT
        e.expeditor_id,
        e.expeditor_name,
        COALESCE(pa.planned, 0)::bigint AS planned,
        COALESCE(va.visited, 0)::bigint AS visited,
        COALESCE(vpa.visited_planned, 0)::bigint AS visited_planned,
        COALESCE(oa.order_count, 0)::bigint AS order_count,
        COALESCE(oa.defect_count, 0)::bigint AS defect_count,
        COALESCE(pay.payment_sum, 0)::numeric(15,2) AS payment_sum
      FROM expeditors e
      LEFT JOIN planned_agg pa ON pa.expeditor_id = e.expeditor_id
      LEFT JOIN visited_agg va ON va.expeditor_id = e.expeditor_id
      LEFT JOIN visited_planned_agg vpa ON vpa.expeditor_id = e.expeditor_id
      LEFT JOIN orders_agg oa ON oa.expeditor_id = e.expeditor_id
      LEFT JOIN payments_agg pay ON pay.expeditor_id = e.expeditor_id
    ),
    totals AS (
      SELECT
        COALESCE(SUM(planned), 0)::bigint AS sum_planned,
        COALESCE(SUM(visited), 0)::bigint AS sum_visited,
        COALESCE(SUM(visited_planned), 0)::bigint AS sum_visited_planned,
        COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
        COALESCE(SUM(defect_count), 0)::bigint AS sum_defects,
        COALESCE(SUM(payment_sum), 0)::numeric(15,2) AS sum_payments
      FROM scored
    )
    SELECT
      s.*,
      COUNT(*) OVER()::bigint AS total_count,
      t.sum_planned,
      t.sum_visited,
      t.sum_visited_planned,
      t.sum_orders,
      t.sum_defects,
      t.sum_payments
    FROM scored s CROSS JOIN totals t
    ORDER BY s.expeditor_name ASC, s.expeditor_id ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: ExpeditorVisitsReportRow[] = rows.map((r, idx) => {
    const planned = Number(r.planned ?? 0);
    // SD triad: Посещено ⊆ план → visited_planned; Не посещено = plan − visited_planned
    const visited = Number(r.visited_planned ?? 0);
    return {
      row_number: offset + idx + 1,
      expeditor_id: r.expeditor_id,
      expeditor_name: r.expeditor_name ?? "",
      planned,
      visited,
      no_visited: Math.max(0, planned - visited),
      order_count: Number(r.order_count ?? 0),
      defect_count: Number(r.defect_count ?? 0),
      payment_sum: decStr(r.payment_sum)
    };
  });

  const sumPlanned = Number(rows[0]?.sum_planned ?? 0);
  const sumVisited = Number(rows[0]?.sum_visited_planned ?? 0);
  const totals: ExpeditorVisitsReportTotals = {
    planned: sumPlanned,
    visited: sumVisited,
    no_visited: Math.max(0, sumPlanned - sumVisited),
    order_count: Number(rows[0]?.sum_orders ?? 0),
    defect_count: Number(rows[0]?.sum_defects ?? 0),
    payment_sum: decStr(rows[0]?.sum_payments)
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
