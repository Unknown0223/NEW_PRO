import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { DiscountDetailReportFilters, DiscountDetailReportRow } from "./discount-detail-report.types";

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

function buildWhere(tenantId: number, f: DiscountDetailReportFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.discount_sum > 0`,
    Prisma.sql`o.order_type IN ('order', 'exchange')`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  if (from) parts.push(Prisma.sql`o.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`o.created_at <= ${to}`);
  if (f.agent_ids?.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    const idTry = Number.parseInt(search, 10);
    if (Number.isFinite(idTry) && idTry > 0) {
      parts.push(
        Prisma.sql`(o.id = ${idTry} OR o.number ILIKE ${pat} OR c.name ILIKE ${pat} OR COALESCE(ag.name, '') ILIKE ${pat})`
      );
    } else {
      parts.push(Prisma.sql`(o.number ILIKE ${pat} OR c.name ILIKE ${pat} OR COALESCE(ag.name, '') ILIKE ${pat})`);
    }
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

export async function getDiscountDetailReport(tenantId: number, f: DiscountDetailReportFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  type Raw = {
    order_id: number;
    order_date: Date;
    order_number: string;
    client_name: string;
    agent_name: string | null;
    discount_sum: Prisma.Decimal;
    total_sum: Prisma.Decimal;
    status: string;
  };

  const [summaryRows, rows] = await Promise.all([
    prisma.$queryRaw<[{ total_count: bigint; sum_discount: Prisma.Decimal; sum_total: Prisma.Decimal }]>`
      SELECT
        COUNT(*)::bigint AS total_count,
        COALESCE(SUM(o.discount_sum), 0)::numeric(15,2) AS sum_discount,
        COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS sum_total
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id)
      WHERE ${whereSql}
    `,
    prisma.$queryRaw<Raw[]>`
      SELECT
        o.id AS order_id,
        o.created_at AS order_date,
        o.number AS order_number,
        c.name AS client_name,
        COALESCE(ag.name, '') AS agent_name,
        o.discount_sum,
        o.total_sum,
        o.status
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id)
      WHERE ${whereSql}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT ${f.limit} OFFSET ${offset}
    `
  ]);

  const summary = summaryRows[0];
  const mapped: DiscountDetailReportRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    order_id: r.order_id,
    order_date: r.order_date.toISOString().slice(0, 10),
    order_number: r.order_number,
    client_name: r.client_name,
    agent_name: r.agent_name ?? "",
    discount_sum: r.discount_sum.toString(),
    total_sum: r.total_sum.toString(),
    status: r.status
  }));

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(summary?.total_count ?? 0),
    totals: {
      discount_sum: (summary?.sum_discount ?? new Prisma.Decimal(0)).toString(),
      total_sum: (summary?.sum_total ?? new Prisma.Decimal(0)).toString()
    },
    rows: mapped
  };
}