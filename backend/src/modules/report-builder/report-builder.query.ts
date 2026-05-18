import { Prisma } from "@prisma/client";

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Prisma.Decimal) return Number(v.toString());
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}
import { prisma } from "../../config/database";
import type { ReportActor } from "../reports/client-sales-4-report.service";
import {
  REPORT_BUILDER_EXPORT_ROW_CAP,
  REPORT_BUILDER_PREVIEW_ROW_CAP
} from "./report-builder.constants";
import { dateExprForMode, fieldExprSql } from "./report-builder.metadata";
import type { ReportBuilderConfigPayload, ReportBuilderMatrixView, ReportBuilderPreviewResult } from "./report-builder.types";

/** CTE: order_status_logs dan shipped_at / delivered_at. */
export const REPORT_BUILDER_STATUS_LOGS_CTE = Prisma.sql`
  status_logs AS (
    SELECT
      sl.order_id,
      MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
      MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
    FROM order_status_logs sl
    GROUP BY sl.order_id
  )`;

function parseUtcDayStart(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
}

function parseUtcDayEndExclusive(ymd: string): Date {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

export function buildReportBuilderWhereSql(
  tenantId: number,
  c: ReportBuilderConfigPayload,
  actor?: ReportActor
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`];

  const dayStart = parseUtcDayStart(c.dateFrom);
  const dayEndExcl = parseUtcDayEndExclusive(c.dateTo);
  const dexpr = dateExprForMode(c.dateMode);
  parts.push(Prisma.sql`${dexpr} >= ${dayStart}`);
  parts.push(Prisma.sql`${dexpr} < ${dayEndExcl}`);

  if (c.statuses.length > 0) {
    parts.push(Prisma.sql`o.status IN (${sqlInStrings(c.statuses)})`);
  } else {
    parts.push(Prisma.sql`o.status <> 'cancelled'`);
  }

  if (c.orderTypes.length > 0) {
    parts.push(Prisma.sql`o.order_type IN (${sqlInStrings(c.orderTypes)})`);
  } else {
    parts.push(Prisma.sql`o.order_type = 'order'`);
  }

  if (c.agentIds.length > 0) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(c.agentIds)})`);
  }

  if (actor?.userId && actor.role === "agent") {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) = ${actor.userId}`);
  } else if (actor?.userId && actor.role === "supervisor") {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users su
        WHERE su.id = COALESCE(o.agent_id, c.agent_id)
          AND su.tenant_id = ${tenantId}
          AND su.supervisor_user_id = ${actor.userId}
      )`
    );
  }

  if (c.warehouseIds.length > 0) {
    parts.push(Prisma.sql`o.warehouse_id IN (${Prisma.join(c.warehouseIds)})`);
  }
  if (c.productIds.length > 0) {
    parts.push(Prisma.sql`p.id IN (${Prisma.join(c.productIds)})`);
  }
  if (c.categoryIds.length > 0) {
    parts.push(Prisma.sql`p.category_id IN (${Prisma.join(c.categoryIds)})`);
  }
  if (c.productGroupIds.length > 0) {
    parts.push(Prisma.sql`p.product_group_id IN (${Prisma.join(c.productGroupIds)})`);
  }
  if (c.brandIds.length > 0) {
    parts.push(Prisma.sql`p.brand_id IN (${Prisma.join(c.brandIds)})`);
  }
  if (c.expeditorUserIds.length > 0) {
    parts.push(Prisma.sql`o.expeditor_user_id IN (${Prisma.join(c.expeditorUserIds)})`);
  }
  if (c.supervisorUserIds.length > 0) {
    parts.push(Prisma.sql`agent.supervisor_user_id IN (${Prisma.join(c.supervisorUserIds)})`);
  }
  if (c.tradeDirectionIds.length > 0) {
    parts.push(Prisma.sql`agent.trade_direction_id IN (${Prisma.join(c.tradeDirectionIds)})`);
  }
  if (c.kpiGroupIds.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM kpi_group_products kgp
        WHERE kgp.product_id = p.id AND kgp.kpi_group_id IN (${Prisma.join(c.kpiGroupIds)})
      )`
    );
  }
  if (c.clientIds.length > 0) {
    parts.push(Prisma.sql`c.id IN (${Prisma.join(c.clientIds)})`);
  }
  if (c.paymentMethodRefs.length > 0) {
    parts.push(Prisma.sql`o.payment_method_ref IN (${sqlInStrings(c.paymentMethodRefs)})`);
  }
  if (c.priceTypeRefs.length > 0) {
    const refs = sqlInStrings(c.priceTypeRefs);
    parts.push(Prisma.sql`
      (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(agent.agent_price_types, '[]'::jsonb)) AS apt(v)
          WHERE btrim(apt.v) IN (${refs})
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(string_to_array(COALESCE(agent.price_type, ''), ',')) AS lpt(v)
          WHERE btrim(lpt.v) IN (${refs})
        )
      )
    `);
  }
  if (c.branchValues.length > 0) {
    parts.push(Prisma.sql`COALESCE(agent.branch, '') IN (${sqlInStrings(c.branchValues)})`);
  }
  if (c.clientCategoryValues.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.category, '')) IN (${sqlInStrings(c.clientCategoryValues)})`);
  }
  if (c.territoryLevel1Values.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${sqlInStrings(c.territoryLevel1Values)})`);
  }
  if (c.territoryLevel2Values.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.region, '')) IN (${sqlInStrings(c.territoryLevel2Values)})`);
  }
  if (c.territoryLevel3Values.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.city, '')) IN (${sqlInStrings(c.territoryLevel3Values)})`);
  }

  return Prisma.join(parts, " AND ");
}

function metricSelects(m: ReportBuilderConfigPayload["metrics"]): Prisma.Sql[] {
  const out: Prisma.Sql[] = [];
  if (m.amount) out.push(Prisma.sql`SUM(oi.total)::numeric(15,2) AS sum_amount`);
  if (m.qty) out.push(Prisma.sql`SUM(oi.qty)::numeric(15,3) AS sum_qty`);
  if (m.volume) {
    out.push(Prisma.sql`SUM(oi.qty * COALESCE(p.volume_m3, 0::numeric))::numeric(18,6) AS sum_volume`);
  }
  if (m.akb) out.push(Prisma.sql`COUNT(DISTINCT o.client_id)::bigint AS akb`);
  return out;
}

function orderBySql(dimIds: string[], m: ReportBuilderConfigPayload["metrics"]): Prisma.Sql {
  if (dimIds.length > 0) {
    // Sort by agg column aliases — fieldExprSql() references joins (c, o, …) only valid inside agg, not in outer SELECT.
    return Prisma.sql`ORDER BY ${Prisma.join(
      dimIds.map((id) => Prisma.sql`${Prisma.raw(`"${reportBuilderSafeFieldAlias(id)}"`)} ASC`),
      ", "
    )}`;
  }
  if (m.amount) return Prisma.sql`ORDER BY sum_amount DESC NULLS LAST`;
  if (m.qty) return Prisma.sql`ORDER BY sum_qty DESC NULLS LAST`;
  if (m.volume) return Prisma.sql`ORDER BY sum_volume DESC NULLS LAST`;
  return Prisma.sql`ORDER BY akb DESC NULLS LAST`;
}

export function reportBuilderSafeFieldAlias(id: string): string {
  return id.replace(/[^a-z0-9_]/g, "_");
}

/** Zakaz satrlari: preview / dataset / count uchun bir xil FROM+JOIN. */
export function reportBuilderJoinSql(tenantId: number): Prisma.Sql {
  return Prisma.sql`
    FROM orders o
    INNER JOIN clients c ON c.id = o.client_id AND c.tenant_id = ${tenantId}
    INNER JOIN order_items oi ON oi.order_id = o.id
    INNER JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    LEFT JOIN users agent ON agent.id = COALESCE(o.agent_id, c.agent_id) AND agent.tenant_id = ${tenantId}
    LEFT JOIN LATERAL (
      SELECT ws.slot_code
      FROM slot_user_links sul
      INNER JOIN work_slots ws ON ws.id = sul.slot_id AND ws.tenant_id = ${tenantId}
      WHERE sul.user_id = agent.id
        AND sul.tenant_id = ${tenantId}
        AND sul.ended_at IS NULL
      ORDER BY sul.id DESC
      LIMIT 1
    ) agent_ws ON true
    LEFT JOIN users sup ON sup.id = agent.supervisor_user_id AND sup.tenant_id = ${tenantId}
    LEFT JOIN users exp ON exp.id = o.expeditor_user_id AND exp.tenant_id = ${tenantId}
    LEFT JOIN warehouses w ON w.id = o.warehouse_id AND w.tenant_id = ${tenantId}
    LEFT JOIN product_categories pc ON pc.id = p.category_id AND pc.tenant_id = ${tenantId}
    LEFT JOIN product_categories pcp ON pcp.id = pc.parent_id AND pcp.tenant_id = ${tenantId}
    LEFT JOIN product_brands pb ON pb.id = p.brand_id AND pb.tenant_id = ${tenantId}
    LEFT JOIN trade_directions td ON td.id = agent.trade_direction_id AND td.tenant_id = ${tenantId}
    LEFT JOIN product_catalog_groups pgc ON pgc.id = p.product_group_id AND pgc.tenant_id = ${tenantId}
    LEFT JOIN product_manufacturers pm ON pm.id = p.manufacturer_id AND pm.tenant_id = ${tenantId}
    LEFT JOIN product_segments pseg ON pseg.id = p.segment_id AND pseg.tenant_id = ${tenantId}
    LEFT JOIN client_balances cb ON cb.client_id = c.id AND cb.tenant_id = ${tenantId}
    LEFT JOIN tenants tnt ON tnt.id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT MAX(sr.created_at) AS return_at
      FROM sales_returns sr
      WHERE sr.order_id = o.id AND sr.tenant_id = o.tenant_id
    ) sret ON true
    LEFT JOIN LATERAL (
      SELECT sr2.refusal_reason_ref AS return_reason
      FROM sales_returns sr2
      WHERE sr2.order_id = o.id AND sr2.tenant_id = o.tenant_id
      ORDER BY sr2.id DESC
      LIMIT 1
    ) sret_reason ON true
  `;
}

export async function runReportBuilderPreview(
  tenantId: number,
  c: ReportBuilderConfigPayload,
  actor?: ReportActor,
  opts?: { exportMode?: boolean }
): Promise<ReportBuilderPreviewResult> {
  const cap = opts?.exportMode ? REPORT_BUILDER_EXPORT_ROW_CAP : REPORT_BUILDER_PREVIEW_ROW_CAP;
  const limit = cap + 1;
  const dimIds = [...c.rowFieldIds, ...c.colFieldIds];
  const whereSql = buildReportBuilderWhereSql(tenantId, c, actor);
  const metricsSql = metricSelects(c.metrics);
  if (metricsSql.length === 0) {
    return { columns: [], rows: [], truncated: false, totalRowCount: 0 };
  }

  const dimSelectParts = dimIds.map(
    (id) => Prisma.sql`${fieldExprSql(id)} AS ${Prisma.raw(`"${reportBuilderSafeFieldAlias(id)}"`)}`
  );
  const dimGroupParts = dimIds.map((id) => fieldExprSql(id));

  const selectCore =
    dimSelectParts.length > 0
      ? Prisma.sql`${Prisma.join(dimSelectParts, ", ")}, ${Prisma.join(metricsSql, ", ")}`
      : Prisma.sql`${Prisma.join(metricsSql, ", ")}`;

  const groupByClause =
    dimGroupParts.length > 0 ? Prisma.sql`GROUP BY ${Prisma.join(dimGroupParts, ", ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH ${REPORT_BUILDER_STATUS_LOGS_CTE},
    agg AS (
      SELECT
        ${selectCore}
      ${reportBuilderJoinSql(tenantId)}
      WHERE ${whereSql}
      ${groupByClause}
    )
    SELECT
      agg.*,
      (SELECT COUNT(*)::bigint FROM agg) AS __rb_total
    FROM agg
    ${orderBySql(dimIds, c.metrics)}
    LIMIT ${limit}
  `;

  const totalRowCount = Number(rows[0]?.__rb_total ?? 0);
  const truncated = rows.length > cap;
  const dataRows = truncated ? rows.slice(0, cap) : rows;
  for (const r of dataRows) {
    delete r.__rb_total;
  }

  const columns =
    dataRows.length > 0
      ? Object.keys(dataRows[0] as object)
      : [...dimIds, ...(c.metrics.amount ? ["sum_amount"] : []), ...(c.metrics.qty ? ["sum_qty"] : []), ...(c.metrics.volume ? ["sum_volume"] : []), ...(c.metrics.akb ? ["akb"] : [])];

  return {
    columns,
    rows: dataRows,
    truncated,
    totalRowCount
  };
}

/** Pivot ko‘rinish: birinchi metrikani (sum_amount > sum_qty > …) matritsaga aylantiradi. */
export function buildMatrixView(
  c: ReportBuilderConfigPayload,
  flat: ReportBuilderPreviewResult
): ReportBuilderMatrixView {
  if (c.colFieldIds.length === 0 || flat.rows.length === 0) {
    return { enabled: false, rowLabels: [], colKeys: [], cells: [], metric: null };
  }

  const rowKey = (r: Record<string, unknown>) =>
    c.rowFieldIds.map((id) => String(r[reportBuilderSafeFieldAlias(id)] ?? r[id] ?? "")).join(" || ");
  const colKey = (r: Record<string, unknown>) =>
    c.colFieldIds.map((id) => String(r[reportBuilderSafeFieldAlias(id)] ?? r[id] ?? "")).join(" || ");

  let metric: ReportBuilderMatrixView["metric"] = null;
  if (c.metrics.amount) metric = "sum_amount";
  else if (c.metrics.qty) metric = "sum_qty";
  else if (c.metrics.volume) metric = "sum_volume";
  else if (c.metrics.akb) metric = "akb";
  if (!metric) return { enabled: false, rowLabels: [], colKeys: [], cells: [], metric: null };

  const colSet = new Map<string, number>();
  const rowMap = new Map<string, Map<string, number>>();

  for (const r of flat.rows) {
    const rk = rowKey(r);
    const ck = colKey(r);
    if (!colSet.has(ck)) colSet.set(ck, colSet.size);
    const key =
      metric === "sum_amount"
        ? "sum_amount"
        : metric === "sum_qty"
          ? "sum_qty"
          : metric === "sum_volume"
            ? "sum_volume"
            : "akb";
    const val = toNumber(r[key]);

    if (!rowMap.has(rk)) rowMap.set(rk, new Map());
    const m = rowMap.get(rk)!;
    m.set(ck, (m.get(ck) ?? 0) + val);
  }

  const colKeys = [...colSet.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  const rowLabels = [...rowMap.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  const cells: (number | null)[][] = rowLabels.map((rl) =>
    colKeys.map((ck) => {
      const v = rowMap.get(rl)?.get(ck);
      return v == null ? null : v;
    })
  );

  return { enabled: true, rowLabels, colKeys, cells, metric };
}
