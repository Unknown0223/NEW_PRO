import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { BonusesReportFilters, BonusesReportRow } from "./bonuses-report.types";
import { buildBonusesReportWhere } from "./bonuses-report.where";
import { STATUS_CTE } from "./expeditor-returns.helpers";

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

function groupSelect(groupBy: BonusesReportFilters["group_by"]): {
  key: Prisma.Sql;
  name: Prisma.Sql;
  sku: Prisma.Sql;
  category: Prisma.Sql;
  agent: Prisma.Sql;
  client: Prisma.Sql;
  groupBySql: Prisma.Sql;
} {
  if (groupBy === "agent") {
    return {
      key: Prisma.sql`COALESCE(ag.id::text, '0')`,
      name: Prisma.sql`COALESCE(ag.name, '—')`,
      sku: Prisma.sql`''`,
      category: Prisma.sql`''`,
      agent: Prisma.sql`COALESCE(ag.name, '')`,
      client: Prisma.sql`''`,
      groupBySql: Prisma.sql`ag.id, ag.name`
    };
  }
  if (groupBy === "client") {
    return {
      key: Prisma.sql`c.id::text`,
      name: Prisma.sql`c.name`,
      sku: Prisma.sql`''`,
      category: Prisma.sql`COALESCE(c.category, '')`,
      agent: Prisma.sql`COALESCE(ag.name, '')`,
      client: Prisma.sql`c.name`,
      groupBySql: Prisma.sql`c.id, c.name, c.category, ag.name`
    };
  }
  if (groupBy === "category") {
    return {
      key: Prisma.sql`COALESCE(pc.id::text, '0')`,
      name: Prisma.sql`COALESCE(pc.name, 'Без категории')`,
      sku: Prisma.sql`''`,
      category: Prisma.sql`COALESCE(pc.name, 'Без категории')`,
      agent: Prisma.sql`''`,
      client: Prisma.sql`''`,
      groupBySql: Prisma.sql`pc.id, pc.name`
    };
  }
  return {
    key: Prisma.sql`p.id::text`,
    name: Prisma.sql`p.name`,
    sku: Prisma.sql`COALESCE(p.sku, '')`,
    category: Prisma.sql`COALESCE(pc.name, '')`,
    agent: Prisma.sql`''`,
    client: Prisma.sql`''`,
    groupBySql: Prisma.sql`p.id, p.name, p.sku, pc.name`
  };
}

export async function getBonusesReport(tenantId: number, f: BonusesReportFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildBonusesReportWhere(tenantId, f, scopedActor);
  const g = groupSelect(f.group_by);
  const offset = (f.page - 1) * f.limit;

  type Raw = {
    group_key: string;
    name: string;
    sku: string;
    category_name: string;
    agent_name: string;
    client_name: string;
    qty: Prisma.Decimal;
    volume_m3: Prisma.Decimal;
    akb: bigint;
    order_count: bigint;
    total_count: bigint;
    sum_qty: Prisma.Decimal;
    sum_volume: Prisma.Decimal;
    sum_akb: bigint;
    sum_orders: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH ${STATUS_CTE},
    base AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        oi.qty,
        oi.qty * COALESCE(p.volume_m3, 0) AS line_volume,
        ${g.key} AS group_key,
        ${g.name} AS name,
        ${g.sku} AS sku,
        ${g.category} AS category_name,
        ${g.agent} AS agent_name,
        ${g.client} AS client_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = o.tenant_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id AND pc.tenant_id = o.tenant_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      WHERE ${whereSql}
    ),
    totals AS (
      SELECT
        COALESCE(SUM(b.qty), 0)::numeric(15,3) AS sum_qty,
        COALESCE(SUM(b.line_volume), 0)::numeric(15,6) AS sum_volume,
        COUNT(DISTINCT b.client_id)::bigint AS sum_akb,
        COUNT(DISTINCT b.order_id)::bigint AS sum_orders
      FROM base b
    ),
    agg AS (
      SELECT
        b.group_key,
        b.name,
        b.sku,
        b.category_name,
        b.agent_name,
        b.client_name,
        SUM(b.qty)::numeric(15,3) AS qty,
        SUM(b.line_volume)::numeric(15,6) AS volume_m3,
        COUNT(DISTINCT b.client_id)::bigint AS akb,
        COUNT(DISTINCT b.order_id)::bigint AS order_count
      FROM base b
      GROUP BY b.group_key, b.name, b.sku, b.category_name, b.agent_name, b.client_name
    )
    SELECT
      a.*,
      COUNT(*) OVER()::bigint AS total_count,
      t.sum_qty,
      t.sum_volume,
      t.sum_akb,
      t.sum_orders
    FROM agg a
    CROSS JOIN totals t
    ORDER BY a.qty DESC, a.name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: BonusesReportRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    group_key: r.group_key,
    name: r.name,
    sku: r.sku ?? "",
    category_name: r.category_name ?? "",
    agent_name: r.agent_name ?? "",
    client_name: r.client_name ?? "",
    qty: decStr(r.qty),
    volume_m3: decStr(r.volume_m3),
    akb: Number(r.akb ?? 0),
    order_count: Number(r.order_count ?? 0)
  }));

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    group_by: f.group_by,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals: {
      qty: decStr(rows[0]?.sum_qty),
      volume_m3: decStr(rows[0]?.sum_volume),
      akb: Number(rows[0]?.sum_akb ?? 0),
      order_count: Number(rows[0]?.sum_orders ?? 0)
    },
    rows: mapped
  };
}
