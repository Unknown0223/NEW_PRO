import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { buildSalesTerritoryAliasClause, salesDateExprByType } from "./dashboard.sales.scope";
import type { SalesDashboardSnapshot } from "./dashboard.sales.types";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

type RiskRow = {
  okb: bigint;
  with_order: bigint;
  with_refusal: bigint;
  visited_only: bigint;
  not_visited: bigint;
  orders_count: bigint;
  refusals_count: bigint;
};

/**
 * ОКБ mijozlari davr bo‘yicha bir-birini kesmaydigan guruhlarga: zakaz → otkaz → tashrif (natijasiz) → непосещение.
 * Otkaz va tashriflarga sana oralig‘i + agent/supervayzer/yo‘nalish/hudud filtrlari qo‘llanadi (ОКБ bilan bir xil).
 */
export async function fetchSalesSnapshotRiskBlock(
  ctx: SalesSnapshotQueryCtx
): Promise<SalesDashboardSnapshot["risk_zone"]> {
  const { tenantId, filters, salesScope, territoryTerms } = ctx;
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T23:59:59.999Z`);
  const agentFilter = Prisma.sql`
    ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
    ${filters.trade_directions.length > 0 ? Prisma.sql`AND COALESCE(u.trade_direction, '') IN (${Prisma.join(filters.trade_directions)})` : Prisma.empty}
    ${buildSalesTerritoryAliasClause("c", territoryTerms)}
  `;
  const agentIds = (col: string) =>
    filters.agent_ids.length > 0
      ? Prisma.sql`AND ${Prisma.raw(col)} IN (${Prisma.join(filters.agent_ids)})`
      : Prisma.empty;

  const mainQuery = prisma.$queryRaw<RiskRow[]>`
    WITH okb AS (
      SELECT DISTINCT caa.client_id
      FROM client_agent_assignments caa
      JOIN clients c ON c.id = caa.client_id
      JOIN users u ON u.id = caa.agent_id
      WHERE caa.tenant_id = ${tenantId}
        ${agentIds("caa.agent_id")}
        ${agentFilter}
    ),
    ord AS (
      SELECT o.client_id, COUNT(DISTINCT o.id)::bigint AS cnt
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${salesScope}
      GROUP BY o.client_id
    ),
    ref AS (
      SELECT cr.client_id, COUNT(*)::bigint AS cnt
      FROM client_refusals cr
      JOIN users u ON u.id = cr.agent_id
      JOIN clients c ON c.id = cr.client_id
      WHERE cr.tenant_id = ${tenantId}
        AND cr.created_at >= ${from}
        AND cr.created_at <= ${to}
        ${agentIds("cr.agent_id")}
        ${agentFilter}
      GROUP BY cr.client_id
    ),
    vis AS (
      SELECT DISTINCT av.client_id
      FROM agent_visits av
      JOIN users u ON u.id = av.agent_id
      JOIN clients c ON c.id = av.client_id
      WHERE av.tenant_id = ${tenantId}
        AND av.client_id IS NOT NULL
        AND av.checked_in_at >= ${from}
        AND av.checked_in_at <= ${to}
        ${agentIds("av.agent_id")}
        ${agentFilter}
    )
    SELECT
      (SELECT COUNT(*) FROM okb)::bigint AS okb,
      COUNT(*) FILTER (WHERE ord.client_id IS NOT NULL)::bigint AS with_order,
      COUNT(*) FILTER (WHERE ord.client_id IS NULL AND ref.client_id IS NOT NULL)::bigint AS with_refusal,
      COUNT(*) FILTER (
        WHERE ord.client_id IS NULL AND ref.client_id IS NULL AND vis.client_id IS NOT NULL
      )::bigint AS visited_only,
      COUNT(*) FILTER (
        WHERE ord.client_id IS NULL AND ref.client_id IS NULL AND vis.client_id IS NULL
      )::bigint AS not_visited,
      (SELECT COALESCE(SUM(cnt), 0) FROM ord)::bigint AS orders_count,
      (SELECT COALESCE(SUM(cnt), 0) FROM ref)::bigint AS refusals_count
    FROM okb
    LEFT JOIN ord ON ord.client_id = okb.client_id
    LEFT JOIN ref ON ref.client_id = okb.client_id
    LEFT JOIN vis ON vis.client_id = okb.client_id
  `;
  const [rows, dailyRows] = await Promise.all([
    mainQuery,
    fetchRiskDaily(ctx, from, to, agentFilter, agentIds)
  ]);
  const r = rows[0];
  return {
    okb: Number(r?.okb ?? 0n),
    with_order: Number(r?.with_order ?? 0n),
    with_refusal: Number(r?.with_refusal ?? 0n),
    visited_only: Number(r?.visited_only ?? 0n),
    not_visited: Number(r?.not_visited ?? 0n),
    orders_count: Number(r?.orders_count ?? 0n),
    refusals_count: Number(r?.refusals_count ?? 0n),
    daily: dailyRows.map((d) => ({
      date: d.day,
      orders: Number(d.orders),
      refusals: Number(d.refusals),
      not_visited: Number(d.not_visited)
    }))
  };
}

type RiskDailyRow = { day: string; orders: bigint; refusals: bigint; not_visited: bigint };

/**
 * Kunlik: zakazlar, otkazlar va непосещение — shu kunga rejalashtirilgan (visit_date yoki visit_weekdays)
 * mijozlardan zakaz/otkaz/tashrif bo‘lmaganlari (supervayzer «не посещено» mantiqi bilan bir xil).
 */
function fetchRiskDaily(
  ctx: SalesSnapshotQueryCtx,
  from: Date,
  to: Date,
  agentFilter: Prisma.Sql,
  agentIds: (col: string) => Prisma.Sql
) {
  const { tenantId, filters, salesScope } = ctx;
  const orderDay = salesDateExprByType(filters.date_type);
  return prisma.$queryRaw<RiskDailyRow[]>`
    WITH days AS (
      SELECT gs::date AS day
      FROM generate_series(${filters.from}::date, ${filters.to}::date, interval '1 day') gs
    ),
    plan AS (
      SELECT DISTINCT d.day, caa.client_id
      FROM days d
      JOIN client_agent_assignments caa
        ON caa.tenant_id = ${tenantId}
       AND (
         (caa.visit_date IS NOT NULL AND caa.visit_date::date = d.day)
         OR (
           caa.visit_date IS NULL
           AND caa.visit_weekdays::jsonb @> jsonb_build_array(EXTRACT(ISODOW FROM d.day)::int)
         )
       )
      JOIN clients c ON c.id = caa.client_id
      JOIN users u ON u.id = caa.agent_id
      WHERE TRUE
        ${agentIds("caa.agent_id")}
        ${agentFilter}
    ),
    ord AS (
      SELECT (${orderDay})::date AS day, o.client_id, COUNT(DISTINCT o.id)::bigint AS cnt
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${salesScope}
      GROUP BY 1, 2
    ),
    ref AS (
      SELECT cr.created_at::date AS day, cr.client_id, COUNT(*)::bigint AS cnt
      FROM client_refusals cr
      JOIN users u ON u.id = cr.agent_id
      JOIN clients c ON c.id = cr.client_id
      WHERE cr.tenant_id = ${tenantId}
        AND cr.created_at >= ${from}
        AND cr.created_at <= ${to}
        ${agentIds("cr.agent_id")}
        ${agentFilter}
      GROUP BY 1, 2
    ),
    vis AS (
      SELECT DISTINCT av.checked_in_at::date AS day, av.client_id
      FROM agent_visits av
      JOIN users u ON u.id = av.agent_id
      JOIN clients c ON c.id = av.client_id
      WHERE av.tenant_id = ${tenantId}
        AND av.client_id IS NOT NULL
        AND av.checked_in_at >= ${from}
        AND av.checked_in_at <= ${to}
        ${agentIds("av.agent_id")}
        ${agentFilter}
    )
    SELECT
      d.day::text AS day,
      COALESCE((SELECT SUM(cnt) FROM ord WHERE ord.day = d.day), 0)::bigint AS orders,
      COALESCE((SELECT SUM(cnt) FROM ref WHERE ref.day = d.day), 0)::bigint AS refusals,
      (
        SELECT COUNT(*)
        FROM plan p
        WHERE p.day = d.day
          AND NOT EXISTS (SELECT 1 FROM ord WHERE ord.day = p.day AND ord.client_id = p.client_id)
          AND NOT EXISTS (SELECT 1 FROM ref WHERE ref.day = p.day AND ref.client_id = p.client_id)
          AND NOT EXISTS (SELECT 1 FROM vis WHERE vis.day = p.day AND vis.client_id = p.client_id)
      )::bigint AS not_visited
    FROM days d
    ORDER BY d.day
  `;
}
