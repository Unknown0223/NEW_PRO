import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ExpeditorGroupRow } from "./dashboard.expeditors.types";
import { loadBranchLabelSources } from "../tenant-settings/tenant-settings.refs";
import { branchLabelLookup, uniqueBranchVisibleNames } from "../tenant-settings/branch-display.pure";

function dec(v: Prisma.Decimal | null | undefined): string {
  return (v ?? new Prisma.Decimal(0)).toFixed(2);
}

function num(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** СВР — агентнинг supervayzeri (role=supervisor). Yetkazuvchining rahbari (masalan, savdo direktori) СВР emas. */
export async function loadOrdersBySupervisor(
  tenantId: number,
  fromUtc: Date,
  toUtc: Date,
  expFilter: Prisma.Sql
): Promise<ExpeditorGroupRow[]> {
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
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount) AS alloc_sum
      FROM payment_allocations pa
      JOIN client_payments p ON p.id = pa.payment_id AND p.tenant_id = pa.tenant_id
      WHERE pa.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        AND COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'
      GROUP BY pa.order_id
    ),
    pay AS (
      SELECT p.order_id, SUM(p.amount) AS collected
      FROM client_payments p
      WHERE p.tenant_id = ${tenantId}
        AND p.entry_kind = 'payment'
        AND p.deleted_at IS NULL
        AND COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'
        AND p.order_id IS NOT NULL
        AND p.created_at >= ${fromUtc} AND p.created_at <= ${toUtc}
      GROUP BY p.order_id
    )
    SELECT
      COALESCE(NULLIF(TRIM(s.name), ''), 'Без СВР') AS name,
      s.code AS code,
      COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered_orders,
      COALESCE(SUM(o.total_sum) FILTER (WHERE o.status = 'delivered'), 0)::numeric(20,2) AS delivered_sum,
      COALESCE(SUM(o.total_sum) FILTER (WHERE o.status = 'returned'), 0)::numeric(20,2) AS returned_sum,
      COALESCE(SUM(pay.collected), 0)::numeric(20,2) AS payments_collected,
      COALESCE(SUM(GREATEST(o.total_sum - COALESCE(al.alloc_sum, 0), 0)) FILTER (WHERE o.status = 'delivered'), 0)::numeric(20,2) AS debt
    FROM orders o
    LEFT JOIN users a ON a.id = o.agent_id AND a.tenant_id = o.tenant_id
    LEFT JOIN users s ON s.id = a.supervisor_user_id AND s.tenant_id = o.tenant_id AND s.role = 'supervisor'
    LEFT JOIN alloc al ON al.order_id = o.id
    LEFT JOIN pay ON pay.order_id = o.id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'order'
      AND o.created_at >= ${fromUtc} AND o.created_at <= ${toUtc}
      ${expFilter}
    GROUP BY 1, 2
  `;
  return rows
    .filter((r) => num(r.delivered_orders) > 0 || Number(r.returned_sum) > 0 || Number(r.payments_collected) > 0)
    .map((r) => ({
      name: r.name,
      code: r.code,
      delivered_orders: num(r.delivered_orders),
      delivered_sum: dec(r.delivered_sum),
      returned_sum: dec(r.returned_sum),
      payments_collected: dec(r.payments_collected),
      debt: dec(r.debt)
    }))
    .sort((a, b) => Number(b.delivered_sum) - Number(a.delivered_sum));
}

export function mergeFilialRows(base: ExpeditorGroupRow[], extra: ExpeditorGroupRow[]): ExpeditorGroupRow[] {
  const map = new Map<string, ExpeditorGroupRow & { _d: Prisma.Decimal; _r: Prisma.Decimal; _p: Prisma.Decimal; _debt: Prisma.Decimal }>();
  const put = (row: ExpeditorGroupRow) => {
    const cur = map.get(row.name) ?? {
      name: row.name,
      code: null,
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
    map.set(row.name, cur);
  };
  for (const row of base) put(row);
  for (const row of extra) put(row);
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

export async function listBranches(tenantId: number) {
  const [rows, catalog] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: { in: ["expeditor", "agent"] },
        branch: { not: null }
      },
      select: { branch: true },
      distinct: ["branch"]
    }),
    loadBranchLabelSources(tenantId)
  ]);
  const raw = rows.map((r) => r.branch?.trim()).filter((b): b is string => Boolean(b));
  for (const b of catalog) {
    if (b.active !== false && b.name.trim()) raw.push(b.name.trim());
  }
  return uniqueBranchVisibleNames(raw, branchLabelLookup(catalog));
}
