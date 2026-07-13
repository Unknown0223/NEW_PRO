import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SupervisorDashboardFilters } from "./dashboard.supervisor.scope";

export type SupervisorVisitRawRow = {
  agent_id: number;
  agent_name: string;
  agent_code: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  planned_visits: bigint;
  visited_planned: bigint;
  visited_total: bigint;
  gps_visits: bigint;
  photo_reports: bigint;
  photo_outlets: bigint;
  photo_count: bigint;
  visits_with_orders: bigint;
  sales_sum: Prisma.Decimal;
  sales_qty: Prisma.Decimal;
  cancelled_count: bigint;
  plan_vis_ord_sum: Prisma.Decimal;
  plan_vis_ord_qty: Prisma.Decimal;
  plan_vis_no_order: bigint;
  plan_novis_ord_sum: Prisma.Decimal;
  plan_novis_ord_qty: Prisma.Decimal;
  plan_photo: bigint;
  out_vis_ord_sum: Prisma.Decimal;
  out_vis_ord_qty: Prisma.Decimal;
  out_vis_no_order: bigint;
  out_novis_ord_sum: Prisma.Decimal;
  out_novis_ord_qty: Prisma.Decimal;
  out_photo: bigint;
};

export type SupervisorVisitQueryResult = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  visitRows: SupervisorVisitRawRow[];
};

export async function fetchSupervisorVisitAndSalesRaw(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
  filters: SupervisorDashboardFilters,
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitQueryResult> {
  const [[salesAgg, cashAgg, paymentBreakdownRows], visitRows] = await Promise.all([
    Promise.all([
      prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
        SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS s
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        WHERE ${orderScope}
      `,
      prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
        SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS s
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        WHERE ${orderScope}
          AND LOWER(COALESCE(o.payment_method_ref, '')) IN ('cash', 'naqd', 'наличные')
      `,
      prisma.$queryRaw<Array<{ method: string; s: Prisma.Decimal }>>`
        SELECT COALESCE(NULLIF(TRIM(o.payment_method_ref), ''), '_') AS method,
               COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS s
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        WHERE ${orderScope}
        GROUP BY 1
        HAVING COALESCE(SUM(o.total_sum), 0) <> 0
        ORDER BY s DESC
      `
    ]),
    prisma.$queryRaw<
    Array<{
      agent_id: number;
      agent_name: string;
      agent_code: string | null;
      supervisor_id: number | null;
      supervisor_name: string | null;
      planned_visits: bigint;
      visited_planned: bigint;
      visited_total: bigint;
      gps_visits: bigint;
      photo_reports: bigint;
      photo_outlets: bigint;
      photo_count: bigint;
      visits_with_orders: bigint;
      sales_sum: Prisma.Decimal;
      sales_qty: Prisma.Decimal;
      cancelled_count: bigint;
      plan_vis_ord_sum: Prisma.Decimal;
      plan_vis_ord_qty: Prisma.Decimal;
      plan_vis_no_order: bigint;
      plan_novis_ord_sum: Prisma.Decimal;
      plan_novis_ord_qty: Prisma.Decimal;
      plan_photo: bigint;
      out_vis_ord_sum: Prisma.Decimal;
      out_vis_ord_qty: Prisma.Decimal;
      out_vis_no_order: bigint;
      out_novis_ord_sum: Prisma.Decimal;
      out_novis_ord_qty: Prisma.Decimal;
      out_photo: bigint;
    }>
  >`
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
    order_by_pair AS (
      SELECT x.agent_id, x.client_id,
        COALESCE(SUM(x.order_total), 0)::numeric(15,2) AS ord_sum,
        COALESCE(SUM(x.line_qty), 0)::numeric(15,3) AS ord_qty
      FROM (
        SELECT o.agent_id, o.client_id, o.id AS oid,
          MAX(o.total_sum)::numeric(15,2) AS order_total,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS line_qty
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE ${orderScope}
        GROUP BY o.agent_id, o.client_id, o.id
      ) x
      GROUP BY x.agent_id, x.client_id
    ),
    plan_visited_pairs AS (
      SELECT v.agent_id, v.client_id
      FROM visits v
      INNER JOIN planned p ON p.agent_id = v.agent_id AND p.client_id = v.client_id
    ),
    unplanned_visited_pairs AS (
      SELECT v.agent_id, v.client_id
      FROM visits v
      WHERE NOT EXISTS (
        SELECT 1 FROM planned p WHERE p.agent_id = v.agent_id AND p.client_id = v.client_id
      )
    ),
    planned_not_visited_pairs AS (
      SELECT p.agent_id, p.client_id
      FROM planned p
      WHERE NOT EXISTS (
        SELECT 1 FROM visits v WHERE v.agent_id = p.agent_id AND v.client_id = p.client_id
      )
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
        ${filters.agent_ids.length > 0 ? Prisma.sql`AND pr.created_by_user_id IN (${Prisma.join(filters.agent_ids)})` : Prisma.empty}
        ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
        ${filters.trade_directions.length > 0 ? Prisma.sql`AND EXISTS (
          SELECT 1
          FROM trade_directions td
          WHERE td.tenant_id = ${tenantId}
            AND td.is_active = true
            AND (td.code IN (${Prisma.join(filters.trade_directions.map((p) => Prisma.sql`${p}`))}) OR td.name IN (${Prisma.join(filters.trade_directions.map((p) => Prisma.sql`${p}`))}))
            AND (
              u.trade_direction_id = td.id
              OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.code, ''))
              OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.name, ''))
            )
        )` : Prisma.empty}
        ${filters.client_categories.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.category, '')) IN (${Prisma.join(filters.client_categories.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        ${filters.territory_1_list.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.zone, '')) IN (${Prisma.join(filters.territory_1_list.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        ${filters.territory_2_list.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.region, '')) IN (${Prisma.join(filters.territory_2_list.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        ${filters.territory_3_list.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.city, '')) IN (${Prisma.join(filters.territory_3_list.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
    ),
    sales_by_agent AS (
      SELECT o.agent_id,
             COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id ELSE NULL END)::bigint AS cancelled_count,
             COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS sales_sum,
             COALESCE(SUM(COALESCE(oi.qty, 0)), 0)::numeric(15,3) AS sales_qty
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
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
    ),
    planned_cnt AS (
      SELECT agent_id, COUNT(*)::bigint AS planned_visits
      FROM planned
      GROUP BY agent_id
    ),
    visit_cnt AS (
      SELECT agent_id, COUNT(*)::bigint AS visited_total
      FROM visits
      GROUP BY agent_id
    ),
    gps_cnt AS (
      SELECT agent_id, COUNT(*)::bigint AS gps_visits
      FROM visits
      WHERE has_gps
      GROUP BY agent_id
    ),
    visited_planned_cnt AS (
      SELECT v.agent_id, COUNT(*)::bigint AS visited_planned
      FROM visits v
      JOIN planned p ON p.agent_id = v.agent_id AND p.client_id = v.client_id
      GROUP BY v.agent_id
    ),
    photo_cnt AS (
      SELECT v.agent_id, COUNT(*)::bigint AS photo_reports
      FROM visits v
      JOIN photos_pairs p2 ON p2.agent_id = v.agent_id AND p2.client_id = v.client_id
      GROUP BY v.agent_id
    ),
    visits_with_orders_cnt AS (
      SELECT v.agent_id, COUNT(*)::bigint AS visits_with_orders
      FROM visits v
      JOIN orders_pairs op ON op.agent_id = v.agent_id AND op.client_id = v.client_id
      GROUP BY v.agent_id
    ),
    plan_vis_order_agg AS (
      SELECT pv.agent_id,
        COALESCE(SUM(obp.ord_sum), 0)::numeric(15,2) AS visited_order_sum,
        COALESCE(SUM(obp.ord_qty), 0)::numeric(15,3) AS visited_order_qty,
        COUNT(*)::bigint AS pv_pair_cnt,
        COUNT(*) FILTER (WHERE obp.agent_id IS NOT NULL)::bigint AS pv_with_order_cnt
      FROM plan_visited_pairs pv
      LEFT JOIN order_by_pair obp ON obp.agent_id = pv.agent_id AND obp.client_id = pv.client_id
      GROUP BY pv.agent_id
    ),
    plan_novis_order_agg AS (
      SELECT pnv.agent_id,
        COALESCE(SUM(obp.ord_sum), 0)::numeric(15,2) AS sum_amt,
        COALESCE(SUM(obp.ord_qty), 0)::numeric(15,3) AS qty_amt
      FROM planned_not_visited_pairs pnv
      JOIN order_by_pair obp ON obp.agent_id = pnv.agent_id AND obp.client_id = pnv.client_id
      GROUP BY pnv.agent_id
    ),
    plan_photo_agg AS (
      SELECT pv.agent_id, COUNT(*)::bigint AS photo_ct
      FROM plan_visited_pairs pv
      JOIN photos_pairs ph ON ph.agent_id = pv.agent_id AND ph.client_id = pv.client_id
      GROUP BY pv.agent_id
    ),
    out_vis_order_agg AS (
      SELECT uv.agent_id,
        COALESCE(SUM(obp.ord_sum), 0)::numeric(15,2) AS visited_order_sum,
        COALESCE(SUM(obp.ord_qty), 0)::numeric(15,3) AS visited_order_qty,
        COUNT(*)::bigint AS uv_pair_cnt,
        COUNT(*) FILTER (WHERE obp.agent_id IS NOT NULL)::bigint AS uv_with_order_cnt
      FROM unplanned_visited_pairs uv
      LEFT JOIN order_by_pair obp ON obp.agent_id = uv.agent_id AND obp.client_id = uv.client_id
      GROUP BY uv.agent_id
    ),
    out_novis_order_agg AS (
      SELECT obp.agent_id,
        COALESCE(SUM(obp.ord_sum), 0)::numeric(15,2) AS sum_amt,
        COALESCE(SUM(obp.ord_qty), 0)::numeric(15,3) AS qty_amt
      FROM order_by_pair obp
      WHERE NOT EXISTS (
        SELECT 1 FROM planned p WHERE p.agent_id = obp.agent_id AND p.client_id = obp.client_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM visits v WHERE v.agent_id = obp.agent_id AND v.client_id = obp.client_id
      )
      GROUP BY obp.agent_id
    ),
    out_photo_agg AS (
      SELECT uv.agent_id, COUNT(*)::bigint AS photo_ct
      FROM unplanned_visited_pairs uv
      JOIN photos_pairs ph ON ph.agent_id = uv.agent_id AND ph.client_id = uv.client_id
      GROUP BY uv.agent_id
    ),
    photo_stats AS (
      SELECT pr.created_by_user_id AS agent_id,
        COUNT(DISTINCT pr.client_id)::bigint AS photo_outlets,
        COUNT(*)::bigint AS photo_count
      FROM client_photo_reports pr
      JOIN users u ON u.id = pr.created_by_user_id
      JOIN clients c ON c.id = pr.client_id
      WHERE pr.tenant_id = ${tenantId}
        AND pr.deleted_at IS NULL
        AND pr.created_at >= ${dayStart}
        AND pr.created_at < ${dayEnd}
        AND pr.created_by_user_id IS NOT NULL
        ${filters.agent_ids.length > 0 ? Prisma.sql`AND pr.created_by_user_id IN (${Prisma.join(filters.agent_ids)})` : Prisma.empty}
        ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
        ${filters.trade_directions.length > 0 ? Prisma.sql`AND EXISTS (
          SELECT 1
          FROM trade_directions td
          WHERE td.tenant_id = ${tenantId}
            AND td.is_active = true
            AND (td.code IN (${Prisma.join(filters.trade_directions.map((p) => Prisma.sql`${p}`))}) OR td.name IN (${Prisma.join(filters.trade_directions.map((p) => Prisma.sql`${p}`))}))
            AND (
              u.trade_direction_id = td.id
              OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.code, ''))
              OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.name, ''))
            )
        )` : Prisma.empty}
        ${filters.client_categories.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.category, '')) IN (${Prisma.join(filters.client_categories.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        ${filters.territory_1_list.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.zone, '')) IN (${Prisma.join(filters.territory_1_list.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        ${filters.territory_2_list.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.region, '')) IN (${Prisma.join(filters.territory_2_list.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        ${filters.territory_3_list.length > 0 ? Prisma.sql`AND btrim(COALESCE(c.city, '')) IN (${Prisma.join(filters.territory_3_list.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
      GROUP BY pr.created_by_user_id
    )
    SELECT
      k.agent_id,
      ua.name AS agent_name,
      ua.code AS agent_code,
      ua.supervisor_user_id AS supervisor_id,
      us.name AS supervisor_name,
      COALESCE(pc.planned_visits, 0)::bigint AS planned_visits,
      COALESCE(vpc.visited_planned, 0)::bigint AS visited_planned,
      COALESCE(vc.visited_total, 0)::bigint AS visited_total,
      COALESCE(gc.gps_visits, 0)::bigint AS gps_visits,
      COALESCE(ph.photo_reports, 0)::bigint AS photo_reports,
      COALESCE(pst.photo_outlets, 0)::bigint AS photo_outlets,
      COALESCE(pst.photo_count, 0)::bigint AS photo_count,
      COALESCE(vwo.visits_with_orders, 0)::bigint AS visits_with_orders,
      COALESCE(sa.sales_sum, 0)::numeric(15,2) AS sales_sum,
      COALESCE(sa.sales_qty, 0)::numeric(15,3) AS sales_qty,
      COALESCE(sa.cancelled_count, 0)::bigint AS cancelled_count,
      COALESCE(pvo.visited_order_sum, 0)::numeric(15,2) AS plan_vis_ord_sum,
      COALESCE(pvo.visited_order_qty, 0)::numeric(15,3) AS plan_vis_ord_qty,
      GREATEST(COALESCE(pvo.pv_pair_cnt, 0) - COALESCE(pvo.pv_with_order_cnt, 0), 0)::bigint AS plan_vis_no_order,
      COALESCE(pnvo.sum_amt, 0)::numeric(15,2) AS plan_novis_ord_sum,
      COALESCE(pnvo.qty_amt, 0)::numeric(15,3) AS plan_novis_ord_qty,
      COALESCE(ppa.photo_ct, 0)::bigint AS plan_photo,
      COALESCE(ovo.visited_order_sum, 0)::numeric(15,2) AS out_vis_ord_sum,
      COALESCE(ovo.visited_order_qty, 0)::numeric(15,3) AS out_vis_ord_qty,
      GREATEST(COALESCE(ovo.uv_pair_cnt, 0) - COALESCE(ovo.uv_with_order_cnt, 0), 0)::bigint AS out_vis_no_order,
      COALESCE(onvo.sum_amt, 0)::numeric(15,2) AS out_novis_ord_sum,
      COALESCE(onvo.qty_amt, 0)::numeric(15,3) AS out_novis_ord_qty,
      COALESCE(opha.photo_ct, 0)::bigint AS out_photo
    FROM keys k
    JOIN users ua ON ua.id = k.agent_id
    LEFT JOIN users us ON us.id = ua.supervisor_user_id
    LEFT JOIN planned_cnt pc ON pc.agent_id = k.agent_id
    LEFT JOIN visit_cnt vc ON vc.agent_id = k.agent_id
    LEFT JOIN gps_cnt gc ON gc.agent_id = k.agent_id
    LEFT JOIN visited_planned_cnt vpc ON vpc.agent_id = k.agent_id
    LEFT JOIN photo_cnt ph ON ph.agent_id = k.agent_id
    LEFT JOIN photo_stats pst ON pst.agent_id = k.agent_id
    LEFT JOIN visits_with_orders_cnt vwo ON vwo.agent_id = k.agent_id
    LEFT JOIN sales_by_agent sa ON sa.agent_id = k.agent_id
    LEFT JOIN plan_vis_order_agg pvo ON pvo.agent_id = k.agent_id
    LEFT JOIN plan_novis_order_agg pnvo ON pnvo.agent_id = k.agent_id
    LEFT JOIN plan_photo_agg ppa ON ppa.agent_id = k.agent_id
    LEFT JOIN out_vis_order_agg ovo ON ovo.agent_id = k.agent_id
    LEFT JOIN out_novis_order_agg onvo ON onvo.agent_id = k.agent_id
    LEFT JOIN out_photo_agg opha ON opha.agent_id = k.agent_id
    ORDER BY ua.name ASC
  `
  ]);
  return { salesAgg, cashAgg, paymentBreakdownRows, visitRows };
}
