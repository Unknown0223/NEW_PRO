import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

/** Pending tasdiqlanmagan to'lovlar hisobga olinmaydi (vedoma bilan bir xil). */
const PAYMENT_NOT_PENDING = Prisma.sql`COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'`;

export type ExpeditorsDashboardFilters = {
  /** YYYY-MM-DD */
  date_from: string;
  /** YYYY-MM-DD */
  date_to: string;
  expeditor_ids: number[];
};

export type ExpeditorDashboardRow = {
  expeditor_user_id: number;
  expeditor_name: string;
  expeditor_code: string | null;
  total_orders: number;
  delivered_orders: number;
  delivered_sum: string;
  returned_orders: number;
  returned_sum: string;
  payments_collected: string;
  debt: string;
};

export type ExpeditorsDashboardResponse = {
  date_from: string;
  date_to: string;
  rows: ExpeditorDashboardRow[];
  totals: {
    expeditors_count: number;
    total_orders: number;
    delivered_orders: number;
    delivered_sum: string;
    returned_orders: number;
    returned_sum: string;
    payments_collected: string;
    debt: string;
  };
  expeditors: Array<{ id: number; name: string; code: string | null }>;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeYmd(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

function csvToIntArray(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function parseExpeditorsDashboardFilters(
  q: Record<string, string | undefined>
): ExpeditorsDashboardFilters {
  const today = new Date();
  const defTo = ymd(today);
  const fromDate = new Date(today);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  const defFrom = ymd(fromDate);

  let from = normalizeYmd(q.date_from) ?? defFrom;
  let to = normalizeYmd(q.date_to) ?? defTo;
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  return {
    date_from: from,
    date_to: to,
    expeditor_ids: csvToIntArray(q.expeditor_ids)
  };
}

function dec(v: Prisma.Decimal | null | undefined): string {
  return (v ?? new Prisma.Decimal(0)).toFixed(2);
}

function num(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type RawRow = {
  expeditor_user_id: number;
  expeditor_name: string | null;
  expeditor_code: string | null;
  total_orders: bigint | number;
  delivered_orders: bigint | number;
  delivered_sum: Prisma.Decimal;
  returned_orders: bigint | number;
  returned_sum: Prisma.Decimal;
  payments_collected: Prisma.Decimal;
  debt: Prisma.Decimal;
};

/** Dastavchiklar (ekspeditor) bo'yicha dashboard: yetkazish, qaytarish, to'lov, qarz. */
export async function getExpeditorsDashboard(
  tenantId: number,
  f: ExpeditorsDashboardFilters
): Promise<ExpeditorsDashboardResponse> {
  const fromUtc = new Date(`${f.date_from}T00:00:00.000Z`);
  const toUtc = new Date(`${f.date_to}T23:59:59.999Z`);
  const expFilter =
    f.expeditor_ids.length > 0
      ? Prisma.sql`AND o.expeditor_user_id IN (${Prisma.join(f.expeditor_ids)})`
      : Prisma.empty;
  const userFilter =
    f.expeditor_ids.length > 0
      ? Prisma.sql`AND u.id IN (${Prisma.join(f.expeditor_ids)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<RawRow[]>`
    WITH ord AS (
      SELECT
        o.expeditor_user_id AS eid,
        COUNT(*) AS total_orders,
        COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered_orders,
        COALESCE(SUM(o.total_sum) FILTER (WHERE o.status = 'delivered'), 0)::numeric(20,2) AS delivered_sum,
        COUNT(*) FILTER (WHERE o.status = 'returned') AS returned_orders,
        COALESCE(SUM(o.total_sum) FILTER (WHERE o.status = 'returned'), 0)::numeric(20,2) AS returned_sum
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.expeditor_user_id IS NOT NULL
        AND o.order_type = 'order'
        AND o.created_at >= ${fromUtc} AND o.created_at <= ${toUtc}
        ${expFilter}
      GROUP BY o.expeditor_user_id
    ),
    alloc AS (
      SELECT pa.order_id, SUM(pa.amount) AS alloc_sum
      FROM payment_allocations pa
      JOIN client_payments p ON p.id = pa.payment_id AND p.tenant_id = pa.tenant_id
      WHERE pa.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        AND ${PAYMENT_NOT_PENDING}
      GROUP BY pa.order_id
    ),
    debt AS (
      SELECT
        o.expeditor_user_id AS eid,
        COALESCE(SUM(GREATEST(o.total_sum - COALESCE(a.alloc_sum, 0), 0)), 0)::numeric(20,2) AS debt_sum
      FROM orders o
      LEFT JOIN alloc a ON a.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND o.expeditor_user_id IS NOT NULL
        AND o.order_type = 'order'
        AND o.status = 'delivered'
        AND o.created_at >= ${fromUtc} AND o.created_at <= ${toUtc}
        ${expFilter}
      GROUP BY o.expeditor_user_id
    ),
    pay AS (
      SELECT
        COALESCE(p.expeditor_user_id, o.expeditor_user_id) AS eid,
        COALESCE(SUM(p.amount), 0)::numeric(20,2) AS collected
      FROM client_payments p
      LEFT JOIN orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
      WHERE p.tenant_id = ${tenantId}
        AND p.entry_kind = 'payment'
        AND p.deleted_at IS NULL
        AND ${PAYMENT_NOT_PENDING}
        AND p.created_at >= ${fromUtc} AND p.created_at <= ${toUtc}
        AND COALESCE(p.expeditor_user_id, o.expeditor_user_id) IS NOT NULL
      GROUP BY COALESCE(p.expeditor_user_id, o.expeditor_user_id)
    ),
    eids AS (
      SELECT eid FROM ord
      UNION
      SELECT eid FROM debt
      UNION
      SELECT eid FROM pay
    )
    SELECT
      u.id AS expeditor_user_id,
      u.name AS expeditor_name,
      u.code AS expeditor_code,
      COALESCE(ord.total_orders, 0) AS total_orders,
      COALESCE(ord.delivered_orders, 0) AS delivered_orders,
      COALESCE(ord.delivered_sum, 0) AS delivered_sum,
      COALESCE(ord.returned_orders, 0) AS returned_orders,
      COALESCE(ord.returned_sum, 0) AS returned_sum,
      COALESCE(pay.collected, 0) AS payments_collected,
      COALESCE(debt.debt_sum, 0) AS debt
    FROM eids
    JOIN users u ON u.id = eids.eid AND u.tenant_id = ${tenantId} AND u.role = 'expeditor'
    LEFT JOIN ord ON ord.eid = eids.eid
    LEFT JOIN pay ON pay.eid = eids.eid
    LEFT JOIN debt ON debt.eid = eids.eid
    WHERE 1 = 1 ${userFilter}
    ORDER BY COALESCE(ord.delivered_sum, 0) DESC, u.name ASC
  `;

  const mapped: ExpeditorDashboardRow[] = rows.map((r) => ({
    expeditor_user_id: r.expeditor_user_id,
    expeditor_name: r.expeditor_name ?? "—",
    expeditor_code: r.expeditor_code,
    total_orders: num(r.total_orders),
    delivered_orders: num(r.delivered_orders),
    delivered_sum: dec(r.delivered_sum),
    returned_orders: num(r.returned_orders),
    returned_sum: dec(r.returned_sum),
    payments_collected: dec(r.payments_collected),
    debt: dec(r.debt)
  }));

  const totals = mapped.reduce(
    (acc, r) => {
      acc.total_orders += r.total_orders;
      acc.delivered_orders += r.delivered_orders;
      acc.delivered_sum = acc.delivered_sum.add(r.delivered_sum);
      acc.returned_orders += r.returned_orders;
      acc.returned_sum = acc.returned_sum.add(r.returned_sum);
      acc.payments_collected = acc.payments_collected.add(r.payments_collected);
      acc.debt = acc.debt.add(r.debt);
      return acc;
    },
    {
      total_orders: 0,
      delivered_orders: 0,
      delivered_sum: new Prisma.Decimal(0),
      returned_orders: 0,
      returned_sum: new Prisma.Decimal(0),
      payments_collected: new Prisma.Decimal(0),
      debt: new Prisma.Decimal(0)
    }
  );

  return {
    date_from: f.date_from,
    date_to: f.date_to,
    rows: mapped,
    totals: {
      expeditors_count: mapped.length,
      total_orders: totals.total_orders,
      delivered_orders: totals.delivered_orders,
      delivered_sum: totals.delivered_sum.toFixed(2),
      returned_orders: totals.returned_orders,
      returned_sum: totals.returned_sum.toFixed(2),
      payments_collected: totals.payments_collected.toFixed(2),
      debt: totals.debt.toFixed(2)
    },
    expeditors: await listExpeditorOptions(tenantId)
  };
}

/** Filtr uchun ekspeditorlar ro'yxati (User role='expeditor'). */
export async function listExpeditorOptions(
  tenantId: number
): Promise<Array<{ id: number; name: string; code: string | null }>> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "expeditor" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code }));
}
