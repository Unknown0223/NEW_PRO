import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { SalesCompareReportFilters, SalesCompareReportRow } from "./sales-compare-report.types";

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

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

function avgStr(sum: Prisma.Decimal | number, orders: bigint | number): string {
  const o = Number(orders ?? 0);
  if (o <= 0) return "0";
  const s = typeof sum === "number" ? sum : Number(sum);
  return (s / o).toFixed(2);
}

function diffPctStr(sumA: Prisma.Decimal | number, sumB: Prisma.Decimal | number): string | null {
  const a = Number(sumA);
  const b = Number(sumB);
  if (a === 0) return b === 0 ? "0" : null;
  return (((b - a) / a) * 100).toFixed(2);
}

function periodCase(
  fromA: Date | null,
  toA: Date | null,
  fromB: Date | null,
  toB: Date | null
): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (fromA && toA) {
    parts.push(Prisma.sql`WHEN o.created_at >= ${fromA} AND o.created_at <= ${toA} THEN 'a'`);
  }
  if (fromB && toB) {
    parts.push(Prisma.sql`WHEN o.created_at >= ${fromB} AND o.created_at <= ${toB} THEN 'b'`);
  }
  if (parts.length === 0) return Prisma.sql`NULL`;
  return Prisma.sql`CASE ${Prisma.join(parts, " ")} ELSE NULL END`;
}

function buildSharedOrderWhere(tenantId: number, f: SalesCompareReportFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`o.status <> 'cancelled'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (f.agent_ids.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.category_ids.length) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM order_items oi_cat
        JOIN products p_cat ON p_cat.id = oi_cat.product_id AND p_cat.tenant_id = ${tenantId}
        WHERE oi_cat.order_id = o.id AND p_cat.category_id IN (${Prisma.join(f.category_ids)})
      )`
    );
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    if (f.group_by === "product") {
      parts.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM order_items oi_s
          JOIN products p_s ON p_s.id = oi_s.product_id AND p_s.tenant_id = ${tenantId}
          WHERE oi_s.order_id = o.id
            AND (p_s.name ILIKE ${pat} OR COALESCE(p_s.sku, '') ILIKE ${pat})
        )`
      );
    } else if (f.group_by === "agent") {
      parts.push(Prisma.sql`COALESCE(ag.name, '') ILIKE ${pat}`);
    } else {
      parts.push(Prisma.sql`c.name ILIKE ${pat}`);
    }
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

function productBaseCte(
  tenantId: number,
  periodExpr: Prisma.Sql,
  sharedWhere: Prisma.Sql
): Prisma.Sql {
  return Prisma.sql`
    base_lines AS (
      SELECT
        ${periodExpr} AS period,
        p.id::text AS group_key,
        p.name AS name,
        o.id AS order_id,
        o.client_id,
        oi.total::numeric(15,2) AS amount
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = ${tenantId}
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      WHERE ${sharedWhere}
        AND ${periodExpr} IS NOT NULL
    )
  `;
}

function orderLevelBaseCte(
  tenantId: number,
  periodExpr: Prisma.Sql,
  sharedWhere: Prisma.Sql,
  groupKey: Prisma.Sql,
  groupName: Prisma.Sql
): Prisma.Sql {
  return Prisma.sql`
    base_lines AS (
      SELECT
        ${periodExpr} AS period,
        ${groupKey} AS group_key,
        ${groupName} AS name,
        o.id AS order_id,
        o.client_id,
        o.total_sum::numeric(15,2) AS amount
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = ${tenantId}
      WHERE ${sharedWhere}
        AND ${periodExpr} IS NOT NULL
    )
  `;
}

export async function getSalesCompareReport(tenantId: number, f: SalesCompareReportFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const fromA = parseDate(f.from_a);
  const toA = parseDateEnd(f.to_a);
  const fromB = parseDate(f.from_b);
  const toB = parseDateEnd(f.to_b);
  const periodExpr = periodCase(fromA, toA, fromB, toB);
  const sharedWhere = buildSharedOrderWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  const baseCte =
    f.group_by === "product"
      ? productBaseCte(tenantId, periodExpr, sharedWhere)
      : f.group_by === "agent"
        ? orderLevelBaseCte(
            tenantId,
            periodExpr,
            sharedWhere,
            Prisma.sql`COALESCE(ag.id::text, '0')`,
            Prisma.sql`COALESCE(ag.name, '—')`
          )
        : orderLevelBaseCte(
            tenantId,
            periodExpr,
            sharedWhere,
            Prisma.sql`c.id::text`,
            Prisma.sql`c.name`
          );

  type Raw = {
    group_key: string;
    name: string;
    sum_a: Prisma.Decimal;
    sum_b: Prisma.Decimal;
    orders_a: bigint;
    orders_b: bigint;
    akb_a: bigint;
    akb_b: bigint;
    total_count: bigint;
    t_sum_a: Prisma.Decimal;
    t_sum_b: Prisma.Decimal;
    t_orders_a: bigint;
    t_orders_b: bigint;
    t_akb_a: bigint;
    t_akb_b: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH ${baseCte},
    agg AS (
      SELECT
        b.period,
        b.group_key,
        MAX(b.name) AS name,
        COALESCE(SUM(b.amount), 0)::numeric(15,2) AS sum,
        COUNT(DISTINCT b.order_id)::bigint AS orders,
        COUNT(DISTINCT b.client_id)::bigint AS akb
      FROM base_lines b
      WHERE b.period IS NOT NULL
      GROUP BY b.period, b.group_key
    ),
    period_a AS (
      SELECT group_key, name, sum, orders, akb FROM agg WHERE period = 'a'
    ),
    period_b AS (
      SELECT group_key, name, sum, orders, akb FROM agg WHERE period = 'b'
    ),
    combined AS (
      SELECT
        COALESCE(a.group_key, b.group_key) AS group_key,
        COALESCE(a.name, b.name, '—') AS name,
        COALESCE(a.sum, 0)::numeric(15,2) AS sum_a,
        COALESCE(b.sum, 0)::numeric(15,2) AS sum_b,
        COALESCE(a.orders, 0)::bigint AS orders_a,
        COALESCE(b.orders, 0)::bigint AS orders_b,
        COALESCE(a.akb, 0)::bigint AS akb_a,
        COALESCE(b.akb, 0)::bigint AS akb_b
      FROM period_a a
      FULL OUTER JOIN period_b b ON a.group_key = b.group_key
    ),
    totals AS (
      SELECT
        COALESCE(SUM(c.sum_a), 0)::numeric(15,2) AS t_sum_a,
        COALESCE(SUM(c.sum_b), 0)::numeric(15,2) AS t_sum_b,
        COALESCE(SUM(c.orders_a), 0)::bigint AS t_orders_a,
        COALESCE(SUM(c.orders_b), 0)::bigint AS t_orders_b,
        COALESCE(SUM(c.akb_a), 0)::bigint AS t_akb_a,
        COALESCE(SUM(c.akb_b), 0)::bigint AS t_akb_b
      FROM combined c
    )
    SELECT
      c.*,
      COUNT(*) OVER()::bigint AS total_count,
      t.t_sum_a,
      t.t_sum_b,
      t.t_orders_a,
      t.t_orders_b,
      t.t_akb_a,
      t.t_akb_b
    FROM combined c
    CROSS JOIN totals t
    ORDER BY c.sum_b DESC, c.sum_a DESC, c.name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: SalesCompareReportRow[] = rows.map((r, idx) => {
    const sumA = r.sum_a;
    const sumB = r.sum_b;
    const diff = Number(sumB) - Number(sumA);
    return {
      row_number: offset + idx + 1,
      group_key: r.group_key,
      name: r.name,
      sum_a: decStr(sumA),
      sum_b: decStr(sumB),
      diff_sum: diff.toFixed(2),
      diff_pct: diffPctStr(sumA, sumB),
      orders_a: Number(r.orders_a ?? 0),
      orders_b: Number(r.orders_b ?? 0),
      akb_a: Number(r.akb_a ?? 0),
      akb_b: Number(r.akb_b ?? 0),
      avg_a: avgStr(sumA, r.orders_a),
      avg_b: avgStr(sumB, r.orders_b)
    };
  });

  const t0 = rows[0];
  const tSumA = t0?.t_sum_a ?? new Prisma.Decimal(0);
  const tSumB = t0?.t_sum_b ?? new Prisma.Decimal(0);

  return {
    period_a: { from: f.from_a, to: f.to_a },
    period_b: { from: f.from_b, to: f.to_b },
    group_by: f.group_by,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals: {
      sum_a: decStr(tSumA),
      sum_b: decStr(tSumB),
      diff_sum: (Number(tSumB) - Number(tSumA)).toFixed(2),
      diff_pct: diffPctStr(tSumA, tSumB),
      orders_a: Number(t0?.t_orders_a ?? 0),
      orders_b: Number(t0?.t_orders_b ?? 0),
      akb_a: Number(t0?.t_akb_a ?? 0),
      akb_b: Number(t0?.t_akb_b ?? 0),
      avg_a: avgStr(tSumA, t0?.t_orders_a ?? 0),
      avg_b: avgStr(tSumB, t0?.t_orders_b ?? 0)
    },
    rows: mapped
  };
}