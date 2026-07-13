import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  orderScopeSql,
  planScopeSql,
  visitScopeSql,
  type SupervisorDashboardFilters
} from "../dashboard/dashboard.service";
import { ORDER_STATUSES } from "../orders/order-status";
import type { DayMetricRow, VisitTotalsFilters, VisitTotalsRow } from "./visit-totals.types";
import { EXPORT_CAP, MAX_RANGE_DAYS, VISIT_TOTALS_ORDER_STATUS_IDS } from "./visit-totals.types";
import { buildScopedAgentWhereForActor } from "../access/access-agent-scope";

export function intList(v?: string): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x) && x > 0);
}

export function utcDayBounds(ymd: string): { dayStart: Date; dayEnd: Date; weekday: number } {
  const dayStart = new Date(`${ymd}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const weekday = ((dayStart.getUTCDay() + 6) % 7) + 1;
  return { dayStart, dayEnd, weekday };
}

export function eachUtcYmdInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = new Date(`${from.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${to.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) return [];
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

export function rangeDayCount(from: string, to: string): number {
  return eachUtcYmdInclusive(from, to).length;
}

export function toDashboardFilters(dayYmd: string, vf: VisitTotalsFilters, actor?: ReportActor): SupervisorDashboardFilters {
  if (actor?.role === "agent" && actor.userId) {
    return {
      date: dayYmd,
      payment_types: [],
      agent_ids: [actor.userId],
      supervisor_ids: [],
      trade_directions: [],
      client_categories: [],
      territory_1_list: [],
      territory_2_list: [],
      territory_3_list: []
    };
  }
  const agent_ids = [...(vf.agent_ids ?? [])];
  const supervisor_ids: number[] = [];
  if (actor?.role === "supervisor" && actor.userId) {
    supervisor_ids.push(actor.userId);
  }
  const order_statuses =
    vf.order_statuses && vf.order_statuses.length > 0
      ? [...new Set(vf.order_statuses.map((s) => s.trim().toLowerCase()).filter((s) => VISIT_TOTALS_ORDER_STATUS_IDS.has(s)))]
      : undefined;

  return {
    date: dayYmd,
    payment_types: [],
    agent_ids: [...new Set(agent_ids)],
    supervisor_ids,
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    order_statuses
  };
}

export function activityAgentPredicate(tenantId: number, agentColumnSql: string, vf: VisitTotalsFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (actor?.userId && actor.role === "agent") {
    parts.push(Prisma.sql`${Prisma.raw(agentColumnSql)} = ${actor.userId}`);
  } else if (actor?.userId && actor.role === "supervisor") {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users u_act
        WHERE u_act.id = ${Prisma.raw(agentColumnSql)}
          AND u_act.tenant_id = ${tenantId}
          AND u_act.supervisor_user_id = ${actor.userId}
      )`
    );
  }
  if (vf.agent_ids && vf.agent_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(agentColumnSql)} IN (${Prisma.join(vf.agent_ids)})`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  return Prisma.join(parts, " AND ");
}

export async function fetchActivityBounds(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
  vf: VisitTotalsFilters,
  actor?: ReportActor
): Promise<Map<number, { first: Date | null; last: Date | null }>> {
  const predAv = activityAgentPredicate(tenantId, "av.agent_id", vf, actor);
  const predO = activityAgentPredicate(tenantId, "o.agent_id", vf, actor);
  const predP = activityAgentPredicate(tenantId, "p.agent_id", vf, actor);

  const rows = await prisma.$queryRaw<Array<{ agent_id: number; first_at: Date | null; last_at: Date | null }>>`
    SELECT agent_id, MIN(evt) AS first_at, MAX(evt) AS last_at
    FROM (
      SELECT av.agent_id, av.checked_in_at AS evt
      FROM agent_visits av
      WHERE av.tenant_id = ${tenantId}
        AND av.checked_in_at >= ${dayStart}
        AND av.checked_in_at < ${dayEnd}
        AND ${predAv}
      UNION ALL
      SELECT o.agent_id, o.created_at AS evt
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.created_at >= ${dayStart}
        AND o.created_at < ${dayEnd}
        AND ${predO}
      UNION ALL
      SELECT p.agent_id, p.recorded_at AS evt
      FROM agent_location_pings p
      WHERE p.tenant_id = ${tenantId}
        AND p.recorded_at >= ${dayStart}
        AND p.recorded_at < ${dayEnd}
        AND ${predP}
    ) x
    GROUP BY agent_id
  `;
  const m = new Map<number, { first: Date | null; last: Date | null }>();
  for (const r of rows) {
    m.set(r.agent_id, { first: r.first_at, last: r.last_at });
  }
  return m;
}



export function zeroDayRow(ag: { id: number; name: string; code: string | null; is_active: boolean }): DayMetricRow {
  return {
    agent_id: ag.id,
    agent_name: ag.name,
    agent_code: ag.code,
    is_active: ag.is_active,
    planned_visits: BigInt(0),
    visited_planned: BigInt(0),
    visited_total: BigInt(0),
    orders_count: BigInt(0),
    sales_sum: new Prisma.Decimal(0)
  };
}

export async function listAgentsForGrid(
  tenantId: number,
  vf: VisitTotalsFilters,
  actor?: ReportActor
): Promise<Array<{ id: number; name: string; code: string | null; is_active: boolean }>> {
  const whereAgent = await buildScopedAgentWhereForActor(tenantId, actor);

  const list = await prisma.user.findMany({
    where: whereAgent,
    select: { id: true, name: true, code: true, is_active: true },
    orderBy: { name: "asc" }
  });

  const uniqById = [...new Map(list.map((a) => [a.id, a])).values()];

  if (actor?.role !== "agent" && vf.agent_ids && vf.agent_ids.length > 0) {
    const allow = new Set(vf.agent_ids);
    return uniqById.filter((a) => allow.has(a.id));
  }
  return uniqById;
}

export async function fetchVisitTotalsForSingleDay(
  tenantId: number,
  dayYmd: string,
  vf: VisitTotalsFilters,
  actor?: ReportActor
): Promise<DayMetricRow[]> {
  const { dayStart, dayEnd, weekday } = utcDayBounds(dayYmd);
  const dashF = toDashboardFilters(dayYmd, vf, actor);
  const orderScope = orderScopeSql(tenantId, dayStart, dayEnd, dashF);
  const visitScope = visitScopeSql(tenantId, dayStart, dayEnd, dashF);
  const planScope = planScopeSql(tenantId, dayStart, dayEnd, weekday, dashF);
  const visitRows = await prisma.$queryRaw<DayMetricRow[]>`
    WITH planned AS (
      SELECT DISTINCT caa.agent_id, caa.client_id
      FROM client_agent_assignments caa
      JOIN users u ON u.id = caa.agent_id
      JOIN clients c ON c.id = caa.client_id
      WHERE ${planScope}
    ),
    visits AS (
      SELECT av.agent_id, av.client_id,
             BOOL_OR(av.latitude IS NOT NULL AND av.longitude IS NOT NULL) AS has_gps
      FROM agent_visits av
      JOIN users u ON u.id = av.agent_id
      LEFT JOIN clients c ON c.id = av.client_id
      WHERE ${visitScope}
      GROUP BY av.agent_id, av.client_id
    ),
    orders_pairs AS (
      SELECT DISTINCT o.agent_id, o.client_id
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${orderScope}
    ),
    photos_pairs AS (
      SELECT DISTINCT pr.created_by_user_id AS agent_id, pr.client_id
      FROM client_photo_reports pr
      JOIN users u ON u.id = pr.created_by_user_id
      JOIN clients c ON c.id = pr.client_id
      WHERE pr.tenant_id = ${tenantId}
        AND pr.deleted_at IS NULL
        AND pr.created_at >= ${dayStart}
        AND pr.created_at < ${dayEnd}
        AND pr.created_by_user_id IS NOT NULL
        ${dashF.agent_ids.length > 0 ? Prisma.sql`AND pr.created_by_user_id IN (${Prisma.join(dashF.agent_ids)})` : Prisma.empty}
        ${dashF.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(dashF.supervisor_ids)})` : Prisma.empty}
    ),
    orders_agg AS (
      SELECT o.agent_id,
             COUNT(*)::bigint AS orders_count,
             COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${orderScope}
      GROUP BY o.agent_id
    ),
    keys AS (
      SELECT agent_id FROM planned
      UNION
      SELECT agent_id FROM visits
      UNION
      SELECT agent_id FROM orders_pairs
      UNION
      SELECT agent_id FROM photos_pairs
    )
    SELECT
      k.agent_id,
      ua.name AS agent_name,
      ua.code AS agent_code,
      ua.is_active AS is_active,
      COALESCE((SELECT COUNT(*) FROM planned p WHERE p.agent_id = k.agent_id), 0)::bigint AS planned_visits,
      COALESCE((
        SELECT COUNT(*)
        FROM visits v
        JOIN planned pl ON pl.agent_id = v.agent_id AND pl.client_id = v.client_id
        WHERE v.agent_id = k.agent_id
      ), 0)::bigint AS visited_planned,
      COALESCE((SELECT COUNT(*) FROM visits v WHERE v.agent_id = k.agent_id), 0)::bigint AS visited_total,
      COALESCE(oa.orders_count, 0)::bigint AS orders_count,
      COALESCE(oa.sales_sum, 0)::numeric(15,2) AS sales_sum
    FROM keys k
    JOIN users ua ON ua.id = k.agent_id AND ua.tenant_id = ${tenantId}
    LEFT JOIN orders_agg oa ON oa.agent_id = k.agent_id
    ORDER BY ua.name ASC
  `;

  return visitRows;
}

export function bigToNum(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  return Number(v);
}

export function decToString(v: Prisma.Decimal | string | number | null | undefined): string {
  if (v == null) return "0";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return v.toString();
}

export function agentLabel(name: string, code: string | null): string {
  const c = (code ?? "").trim();
  return c ? `${c} — ${name}` : name;
}

export function matchesSearch(label: string, search: string): boolean {
  const t = search.trim().toLowerCase();
  if (!t) return true;
  return label.toLowerCase().includes(t);
}

export function dedupeVisitTotalsRows(rows: VisitTotalsRow[]): VisitTotalsRow[] {
  const m = new Map<string, VisitTotalsRow>();
  const minIso = (a: string | null, b: string | null): string | null => {
    const xs = [a, b].filter((x): x is string => Boolean(x));
    if (xs.length === 0) return null;
    const t = Math.min(...xs.map((s) => new Date(s).getTime()));
    return new Date(t).toISOString();
  };
  const maxIso = (a: string | null, b: string | null): string | null => {
    const xs = [a, b].filter((x): x is string => Boolean(x));
    if (xs.length === 0) return null;
    const t = Math.max(...xs.map((s) => new Date(s).getTime()));
    return new Date(t).toISOString();
  };

  for (const row of rows) {
    const key = `${row.work_date}:${row.agent_id}`;
    const ex = m.get(key);
    if (!ex) {
      m.set(key, { ...row });
      continue;
    }
    const visitedPlanned = ex.planned - ex.not_visited;
    const visitPct = ex.planned > 0 ? Math.round((visitedPlanned / ex.planned) * 1000) / 10 : 0;
    const conv =
      ex.visited > 0 ? Math.round((ex.orders_count / ex.visited) * 1000) / 10 : 0;
    const avgOrd =
      ex.orders_count > 0 ? (Number(ex.sales_sum) / ex.orders_count).toFixed(2) : "0";

    m.set(key, {
      ...ex,
      first_activity_at: minIso(ex.first_activity_at, row.first_activity_at),
      last_activity_at: maxIso(ex.last_activity_at, row.last_activity_at),
      visit_completion_pct: visitPct,
      conversion_orders_per_visit: conv,
      avg_order_value: avgOrd
    });
  }
  return [...m.values()];
}

export function sortRowsDefaultStable(rows: VisitTotalsRow[]): VisitTotalsRow[] {
  return [...rows].sort((a, b) => {
    const c1 = a.work_date.localeCompare(b.work_date);
    if (c1 !== 0) return c1;
    return a.agent_label.localeCompare(b.agent_label, "ru");
  });
}
