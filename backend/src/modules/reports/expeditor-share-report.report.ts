import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import { actorHasUnrestrictedDataScope, uniquePositiveIds } from "../access/access-staff-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type {
  ExpeditorShareReportFilters,
  ExpeditorShareReportRow,
  ExpeditorShareReportTotals
} from "./expeditor-share-report.types";

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

function sharePctStr(sales: Prisma.Decimal | number, total: Prisma.Decimal | number): string {
  const s = Number(sales);
  const t = Number(total);
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return "0";
  return ((s / t) * 100).toFixed(2);
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
  order_count: bigint;
  sales_sum: Prisma.Decimal;
  client_count: bigint;
  payment_sum: Prisma.Decimal;
  total_count: bigint;
  sum_orders: bigint;
  sum_sales: Prisma.Decimal;
  sum_clients: bigint;
  sum_payments: Prisma.Decimal;
};

export async function getExpeditorShareReport(
  tenantId: number,
  f: ExpeditorShareReportFilters,
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
    WITH expeditors AS (
      SELECT u.id AS expeditor_id, COALESCE(NULLIF(u.name, ''), '—') AS expeditor_name
      FROM users u
      WHERE ${expWhere}
    ),
    orders_agg AS (
      SELECT
        o.expeditor_user_id AS expeditor_id,
        COUNT(*)::bigint AS order_count,
        COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.client_id)::bigint AS client_count
      FROM orders o
      JOIN expeditors e ON e.expeditor_id = o.expeditor_user_id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status <> 'cancelled'
        AND o.expeditor_user_id IS NOT NULL
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
    scored AS (
      SELECT
        e.expeditor_id,
        e.expeditor_name,
        COALESCE(oa.order_count, 0)::bigint AS order_count,
        COALESCE(oa.sales_sum, 0)::numeric(15,2) AS sales_sum,
        COALESCE(oa.client_count, 0)::bigint AS client_count,
        COALESCE(pay.payment_sum, 0)::numeric(15,2) AS payment_sum
      FROM expeditors e
      LEFT JOIN orders_agg oa ON oa.expeditor_id = e.expeditor_id
      LEFT JOIN payments_agg pay ON pay.expeditor_id = e.expeditor_id
    ),
    totals AS (
      SELECT
        COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
        COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales,
        COALESCE(SUM(client_count), 0)::bigint AS sum_clients,
        COALESCE(SUM(payment_sum), 0)::numeric(15,2) AS sum_payments
      FROM scored
    )
    SELECT
      s.*,
      COUNT(*) OVER()::bigint AS total_count,
      t.sum_orders,
      t.sum_sales,
      t.sum_clients,
      t.sum_payments
    FROM scored s
    CROSS JOIN totals t
    ORDER BY s.sales_sum DESC, s.expeditor_name ASC, s.expeditor_id ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const sumSales = rows[0]?.sum_sales ?? new Prisma.Decimal(0);

  const mapped: ExpeditorShareReportRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    expeditor_id: r.expeditor_id,
    expeditor_name: r.expeditor_name ?? "",
    order_count: Number(r.order_count ?? 0),
    sales_sum: decStr(r.sales_sum),
    share_pct: sharePctStr(r.sales_sum, sumSales),
    client_count: Number(r.client_count ?? 0),
    payment_sum: decStr(r.payment_sum)
  }));

  const totals: ExpeditorShareReportTotals = {
    order_count: Number(rows[0]?.sum_orders ?? 0),
    sales_sum: decStr(rows[0]?.sum_sales),
    client_count: Number(rows[0]?.sum_clients ?? 0),
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