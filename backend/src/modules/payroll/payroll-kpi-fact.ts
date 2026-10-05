import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  allocatePeriodReturns,
  type FactLine,
  type KpiMetrics,
  type OrphanReturn,
  type PeriodCandidate,
  type ReturnAlloc
} from "./payroll-kpi-fact.pure";

export type DatedFactLine = FactLine & { delivered_at: Date; created_at: Date; fully_returned: boolean };
type Range = { from: Date; to: Date };

export type LineFilter = { agentIds?: number[]; expeditorIds?: number[]; slotIds?: number[]; clientIds?: number[] };

export function filterSql(f: LineFilter): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.agentIds?.length) parts.push(Prisma.sql`o.agent_id = ANY(${f.agentIds}::int[])`);
  if (f.expeditorIds?.length) parts.push(Prisma.sql`o.expeditor_user_id = ANY(${f.expeditorIds}::int[])`);
  if (f.slotIds?.length) parts.push(Prisma.sql`o.work_slot_id = ANY(${f.slotIds}::int[])`);
  if (f.clientIds?.length) parts.push(Prisma.sql`o.client_id = ANY(${f.clientIds}::int[])`);
  if (!parts.length) return Prisma.empty;
  return Prisma.sql`AND (${Prisma.join(parts, " OR ")})`;
}

/** Oxirgi superseded bo'lmagan `delivered` logi shu oraliqda bo'lgan zakaz qatorlari (bonus emas). */
export async function loadDeliveredLines(tenantId: number, range: Range, f: LineFilter): Promise<DatedFactLine[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      order_id: number;
      agent_id: number | null;
      expeditor_user_id: number | null;
      work_slot_id: number | null;
      client_id: number;
      created_at: Date;
      delivered_at: Date;
      product_id: number;
      qty: Prisma.Decimal;
      total: Prisma.Decimal;
      volume_unit: Prisma.Decimal;
      fully_returned: boolean;
    }>
  >`
    WITH dl AS (
      SELECT l.order_id, MAX(l.created_at) AS delivered_at
      FROM order_status_logs l
      JOIN orders o ON o.id = l.order_id
      WHERE o.tenant_id = ${tenantId} AND o.order_type = 'order' AND o.status <> 'cancelled'
        AND l.to_status = 'delivered' AND l.superseded_at IS NULL
        AND l.created_at >= ${range.from} AND l.created_at < ${range.to}
        ${filterSql(f)}
        AND NOT EXISTS (
          SELECT 1 FROM order_status_logs l2
          WHERE l2.order_id = l.order_id AND l2.to_status = 'delivered'
            AND l2.superseded_at IS NULL AND l2.created_at >= ${range.to}
        )
      GROUP BY l.order_id
    )
    SELECT o.id AS order_id, o.agent_id, o.expeditor_user_id, o.work_slot_id, o.client_id, o.created_at,
           dl.delivered_at, oi.product_id, oi.qty, oi.total, COALESCE(p.volume_m3, 0) AS volume_unit,
           (o.status = 'returned') AS fully_returned
    FROM dl
    JOIN orders o ON o.id = dl.order_id
    JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
    JOIN products p ON p.id = oi.product_id`;
  return rows.map((r) => ({
    order_id: r.order_id,
    agent_id: r.agent_id,
    expeditor_user_id: r.expeditor_user_id,
    work_slot_id: r.work_slot_id,
    client_id: r.client_id,
    created_at: r.created_at,
    delivered_at: r.delivered_at,
    product_id: r.product_id,
    qty: Number(r.qty),
    total: Number(r.total),
    volume_unit: Number(r.volume_unit),
    fully_returned: r.fully_returned
  }));
}

export async function loadProductGroups(tenantId: number): Promise<Map<number, number[]>> {
  const rows = await prisma.kpiGroupProduct.findMany({
    where: { kpi_group: { tenant_id: tenantId, is_active: true } },
    select: { kpi_group_id: true, product_id: true }
  });
  const m = new Map<number, number[]>();
  for (const r of rows) m.set(r.product_id, [...(m.get(r.product_id) ?? []), r.kpi_group_id]);
  return m;
}

const DAY_MS = 86_400_000;
export const PAID_QTY = Prisma.sql`SUM(COALESCE(srl.paid_qty, srl.qty - COALESCE(srl.bonus_qty, 0)))`;

type PeriodRow = { return_id: number; client_id: number; date_from: Date; date_to: Date; product_id: number; qty: number };

/** Davr qaytarishlarini mijozning shu oraliqda yetkazilgan (to'liq qaytarilmagan) zakazlariga taqsimlash. */
export async function allocatePeriodRows(tenantId: number, rows: PeriodRow[]) {
  if (!rows.length) {
    return {
      allocs: [] as ReturnAlloc[],
      unallocated: [] as Array<{ return_id: number; product_id: number; qty: number }>,
      candLines: [] as DatedFactLine[]
    };
  }
  const minFrom = new Date(Math.min(...rows.map((r) => r.date_from.getTime())));
  const maxTo = new Date(Math.max(...rows.map((r) => r.date_to.getTime())) + DAY_MS);
  const candLines = (
    await loadDeliveredLines(tenantId, { from: minFrom, to: maxTo }, { clientIds: [...new Set(rows.map((r) => r.client_id))] })
  ).filter((c) => !c.fully_returned);
  const candidatesByReturn = new Map<number, PeriodCandidate[]>();
  for (const pr of rows) {
    if (candidatesByReturn.has(pr.return_id)) continue;
    const endExcl = pr.date_to.getTime() + DAY_MS;
    candidatesByReturn.set(
      pr.return_id,
      candLines
        .filter(
          (c) =>
            c.client_id === pr.client_id &&
            c.delivered_at.getTime() >= pr.date_from.getTime() &&
            c.delivered_at.getTime() < endExcl
        )
        .map((c) => ({ order_id: c.order_id, client_id: c.client_id, product_id: c.product_id, qty: c.qty }))
    );
  }
  return { ...allocatePeriodReturns(rows, candidatesByReturn), candLines };
}

/**
 * Zakazga taqsimlanmagan qaytarishlar (davrsiz yoki davrida yetkazish yo'q): shu oyda yaratilgan,
 * mijozga oxirgi sotgan agentga yoziladi. Narx: ko'zgu zakaz → agent zakazi → mahsulotning oxirgi narxi.
 */
export async function loadOrphanReturns(tenantId: number, range: Range, agentIds: number[]): Promise<OrphanReturn[]> {
  if (!agentIds.length) return [];
  const rows = await prisma.$queryRaw<
    Array<{
      return_id: number;
      client_id: number;
      date_from: Date | null;
      date_to: Date | null;
      product_id: number;
      qty: Prisma.Decimal;
      agent_id: number;
      work_slot_id: number | null;
      unit_price: Prisma.Decimal | null;
      volume_unit: Prisma.Decimal;
    }>
  >`
    WITH x AS (
      SELECT sr.id AS return_id, sr.client_id, sr.date_from, sr.date_to, sr.created_at, sr.mirror_order_id,
             srl.product_id, ${PAID_QTY} AS qty
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.return_id = sr.id
      WHERE sr.tenant_id = ${tenantId} AND sr.status <> 'cancelled' AND sr.order_id IS NULL
        AND sr.created_at >= ${range.from} AND sr.created_at < ${range.to}
      GROUP BY sr.id, sr.client_id, sr.date_from, sr.date_to, sr.created_at, sr.mirror_order_id, srl.product_id
    )
    SELECT x.return_id, x.client_id, x.date_from, x.date_to, x.product_id, x.qty,
           a.agent_id, a.work_slot_id, COALESCE(p.volume_m3, 0) AS volume_unit,
           COALESCE(
             (SELECT ABS(mi.total) / mi.qty FROM order_items mi
              WHERE mi.order_id = x.mirror_order_id AND mi.product_id = x.product_id AND mi.qty > 0 AND mi.total <> 0 LIMIT 1),
             a.unit_price,
             (SELECT oi.total / oi.qty FROM order_items oi JOIN orders o2 ON o2.id = oi.order_id
              WHERE o2.tenant_id = ${tenantId} AND o2.order_type = 'order' AND oi.product_id = x.product_id
                AND oi.is_bonus = false AND oi.qty > 0
              ORDER BY o2.created_at DESC LIMIT 1)
           ) AS unit_price
    FROM x
    JOIN products p ON p.id = x.product_id
    JOIN LATERAL (
      SELECT o.agent_id, o.work_slot_id,
             (SELECT oi.total / oi.qty FROM order_items oi
              WHERE oi.order_id = o.id AND oi.product_id = x.product_id AND oi.is_bonus = false AND oi.qty > 0 LIMIT 1) AS unit_price
      FROM orders o
      WHERE o.tenant_id = ${tenantId} AND o.client_id = x.client_id AND o.order_type = 'order'
        AND o.status <> 'cancelled' AND o.agent_id IS NOT NULL AND o.created_at <= x.created_at
      ORDER BY EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = x.product_id AND oi.is_bonus = false
      ) DESC, o.created_at DESC
      LIMIT 1
    ) a ON true
    WHERE a.agent_id = ANY(${agentIds}::int[])`;
  if (!rows.length) return [];

  const periodRows: PeriodRow[] = rows
    .filter((r) => r.date_from && r.date_to)
    .map((r) => ({
      return_id: r.return_id,
      client_id: r.client_id,
      date_from: r.date_from!,
      date_to: r.date_to!,
      product_id: r.product_id,
      qty: Number(r.qty)
    }));
  const { unallocated } = await allocatePeriodRows(tenantId, periodRows);
  const left = new Map(unallocated.map((u) => [`${u.return_id}:${u.product_id}`, u.qty]));
  return rows.flatMap((r) => {
    const qty = r.date_from && r.date_to ? (left.get(`${r.return_id}:${r.product_id}`) ?? 0) : Number(r.qty);
    if (qty <= 0) return [];
    return [
      {
        agent_id: r.agent_id,
        work_slot_id: r.work_slot_id,
        product_id: r.product_id,
        qty,
        unit_price: Number(r.unit_price ?? 0),
        volume_unit: Number(r.volume_unit)
      }
    ];
  });
}

export type { KpiMetrics };
