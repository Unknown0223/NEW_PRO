import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ExpeditorDashboardRow, ExpeditorGroupRow, ExpeditorStatusRow } from "./dashboard.expeditors.service";

function dec(v: Prisma.Decimal | null | undefined): string {
  return (v ?? new Prisma.Decimal(0)).toFixed(2);
}
function num(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
export function rollupExpeditors(
  rows: ExpeditorDashboardRow[],
  keyOf: (row: ExpeditorDashboardRow) => { name: string; code: string | null }
): ExpeditorGroupRow[] {
  const map = new Map<string, ExpeditorGroupRow & { _d: Prisma.Decimal; _r: Prisma.Decimal; _p: Prisma.Decimal; _debt: Prisma.Decimal }>();
  for (const row of rows) {
    const k = keyOf(row);
    const id = `${k.name}\0${k.code ?? ""}`;
    const cur = map.get(id) ?? {
      name: k.name,
      code: k.code,
      delivered_orders: 0,
      delivered_sum: "0",
      returned_sum: "0",
      payments_collected: "0",
      debt: "0",
      _d: new Prisma.Decimal(0),
      _r: new Prisma.Decimal(0),
      _p: new Prisma.Decimal(0),
      _debt: new Prisma.Decimal(0)
    };
    cur.delivered_orders += row.delivered_orders;
    cur._d = cur._d.add(row.delivered_sum);
    cur._r = cur._r.add(row.returned_sum);
    cur._p = cur._p.add(row.payments_collected);
    cur._debt = cur._debt.add(row.debt);
    map.set(id, cur);
  }
  return [...map.values()]
    .map((r) => ({
      name: r.name,
      code: r.code,
      delivered_orders: r.delivered_orders,
      delivered_sum: r._d.toFixed(2),
      returned_sum: r._r.toFixed(2),
      payments_collected: r._p.toFixed(2),
      debt: r._debt.toFixed(2)
    }))
    .sort((a, b) => Number(b.delivered_sum) - Number(a.delivered_sum));
}

type GroupKind = "filial" | "supervisor" | "agent";

export async function loadExpeditorGroup(
  tenantId: number,
  fromUtc: Date,
  toUtc: Date,
  expFilter: Prisma.Sql,
  kind: GroupKind
): Promise<ExpeditorGroupRow[]> {
  const nameExpr =
    kind === "filial"
      ? Prisma.sql`COALESCE(NULLIF(TRIM(e.branch), ''), '—')`
      : kind === "supervisor"
        ? Prisma.sql`COALESCE(NULLIF(TRIM(s.name), ''), '—')`
        : Prisma.sql`COALESCE(NULLIF(TRIM(a.name), ''), 'Без агента')`;
  const codeExpr =
    kind === "filial"
      ? Prisma.sql`NULL::text`
      : kind === "supervisor"
        ? Prisma.sql`s.code`
        : Prisma.sql`a.code`;
  const joins =
    kind === "supervisor"
      ? Prisma.sql`LEFT JOIN users s ON s.id = e.supervisor_user_id`
      : kind === "agent"
        ? Prisma.sql`LEFT JOIN users a ON a.id = o.agent_id`
        : Prisma.empty;
  const rows = await prisma.$queryRaw<
    Array<{
      name: string;
      code: string | null;
      delivered_orders: bigint | number;
      delivered_sum: Prisma.Decimal;
      returned_sum: Prisma.Decimal;
      payments_collected: Prisma.Decimal;
      debt: Prisma.Decimal;
    }>
  >`
    WITH ord AS (
      SELECT
        ${nameExpr} AS name,
        ${codeExpr} AS code,
        COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered_orders,
        COALESCE(SUM(o.total_sum) FILTER (WHERE o.status = 'delivered'), 0)::numeric(20,2) AS delivered_sum,
        COALESCE(SUM(o.total_sum) FILTER (WHERE o.status = 'returned'), 0)::numeric(20,2) AS returned_sum
      FROM orders o
      LEFT JOIN users e ON e.id = o.expeditor_user_id AND e.tenant_id = o.tenant_id
      ${joins}
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.created_at >= ${fromUtc} AND o.created_at <= ${toUtc}
        ${expFilter}
      GROUP BY 1, 2
    )
    SELECT
      ord.name,
      ord.code,
      ord.delivered_orders,
      ord.delivered_sum,
      ord.returned_sum,
      0::numeric(20,2) AS payments_collected,
      0::numeric(20,2) AS debt
    FROM ord
    ORDER BY ord.delivered_sum DESC, ord.name ASC
    LIMIT 200
  `;
  return rows.map((r) => ({
    name: r.name || "—",
    code: r.code,
    delivered_orders: num(r.delivered_orders),
    delivered_sum: dec(r.delivered_sum),
    returned_sum: dec(r.returned_sum),
    payments_collected: dec(r.payments_collected),
    debt: dec(r.debt)
  }));
}

const STATUS_KEYS = ["new", "confirmed", "picking", "delivering", "returned", "cancelled"] as const;

export async function loadStatusBreakdown(
  tenantId: number,
  fromUtc: Date,
  toUtc: Date,
  expFilter: Prisma.Sql
): Promise<Record<"filial" | "supervisor" | "agent" | "expeditor", ExpeditorStatusRow[]>> {
  const facts = await prisma.$queryRaw<
    Array<{
      eid: number | null;
      aid: number | null;
      branch: string | null;
      svr_name: string | null;
      svr_code: string | null;
      agent_name: string | null;
      agent_code: string | null;
      exp_name: string | null;
      exp_code: string | null;
      status: string;
      qty: bigint | number;
      amount: Prisma.Decimal;
      age_days: number;
    }>
  >`
    SELECT
      o.expeditor_user_id AS eid,
      o.agent_id AS aid,
      NULLIF(TRIM(e.branch), '') AS branch,
      NULLIF(TRIM(s.name), '') AS svr_name,
      s.code AS svr_code,
      NULLIF(TRIM(a.name), '') AS agent_name,
      a.code AS agent_code,
      NULLIF(TRIM(e.name), '') AS exp_name,
      e.code AS exp_code,
      o.status AS status,
      COUNT(*) AS qty,
      COALESCE(SUM(o.total_sum), 0)::numeric(20,2) AS amount,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - MIN(o.created_at))) / 86400)::int AS age_days
    FROM orders o
    LEFT JOIN users e ON e.id = o.expeditor_user_id AND e.tenant_id = o.tenant_id
    LEFT JOIN users s ON s.id = e.supervisor_user_id
    LEFT JOIN users a ON a.id = o.agent_id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'order'
      AND o.status <> 'delivered'
      AND o.created_at >= ${fromUtc} AND o.created_at <= ${toUtc}
      AND o.created_at < NOW() - INTERVAL '1 day'
      ${expFilter}
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
  `;

  const bucket = () => new Map<string, ExpeditorStatusRow & { _s: Record<string, Prisma.Decimal>; _days: Record<string, number> }>();
  const dims = {
    filial: bucket(),
    supervisor: bucket(),
    agent: bucket(),
    expeditor: bucket()
  };
  const touch = (
    map: ReturnType<typeof bucket>,
    name: string,
    code: string | null,
    status: string,
    qty: number,
    amount: Prisma.Decimal,
    ageDays: number
  ) => {
    if (!(STATUS_KEYS as readonly string[]).includes(status)) return;
    const id = `${name}\0${code ?? ""}`;
    const cur = map.get(id) ?? {
      name,
      code,
      delivered_orders: 0,
      delivered_sum: "0",
      by_status: {},
      by_status_days: {},
      _s: {},
      _days: {}
    };
    cur.delivered_orders += qty;
    cur._s[status] = (cur._s[status] ?? new Prisma.Decimal(0)).add(amount);
    cur._days[status] = Math.max(cur._days[status] ?? 0, ageDays);
    map.set(id, cur);
  };
  for (const f of facts) {
    const qty = num(f.qty);
    const age = num(f.age_days);
    touch(dims.filial, f.branch || "Без филиала", null, f.status, qty, f.amount, age);
    touch(dims.supervisor, f.svr_name || "Без СВР", f.svr_code, f.status, qty, f.amount, age);
    touch(dims.agent, f.agent_name || "Без агента", f.agent_code, f.status, qty, f.amount, age);
    touch(dims.expeditor, f.exp_name || "Без доставщика", f.exp_code, f.status, qty, f.amount, age);
  }
  const finish = (map: ReturnType<typeof bucket>): ExpeditorStatusRow[] =>
    [...map.values()]
      .map((r) => ({
        name: r.name,
        code: r.code,
        delivered_orders: r.delivered_orders,
        delivered_sum: "0",
        by_status: Object.fromEntries(STATUS_KEYS.map((k) => [k, (r._s[k] ?? new Prisma.Decimal(0)).toFixed(2)])),
        by_status_days: Object.fromEntries(STATUS_KEYS.map((k) => [k, r._days[k] ?? 0]))
      }))
      .sort((a, b) => Number(b.by_status.delivering ?? 0) - Number(a.by_status.delivering ?? 0));
  return {
    filial: finish(dims.filial),
    supervisor: finish(dims.supervisor),
    agent: finish(dims.agent),
    expeditor: finish(dims.expeditor)
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

export async function listRoleOptions(tenantId: number, role: string) {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, role, is_active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
    take: 500
  });
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code }));
}

export async function listBranches(tenantId: number) {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "expeditor", branch: { not: null } },
    select: { branch: true },
    distinct: ["branch"]
  });
  return [...new Set(rows.map((r) => r.branch?.trim()).filter((b): b is string => Boolean(b)))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
}
