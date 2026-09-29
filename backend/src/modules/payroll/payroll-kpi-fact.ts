import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  aggregateKpiFact,
  allocatePeriodReturns,
  mergeUserFacts,
  ZERO_METRICS,
  type FactLine,
  type KpiMetrics,
  type PeriodCandidate,
  type ReturnAlloc,
  type UserFact
} from "./payroll-kpi-fact.pure";

export type DatedFactLine = FactLine & { delivered_at: Date; created_at: Date };
type Range = { from: Date; to: Date };

type LineFilter = { agentIds?: number[]; expeditorIds?: number[]; slotIds?: number[]; clientIds?: number[] };

function filterSql(f: LineFilter): Prisma.Sql {
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
           dl.delivered_at, oi.product_id, oi.qty, oi.total, COALESCE(p.volume_m3, 0) AS volume_unit
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
    volume_unit: Number(r.volume_unit)
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

/** Zakazga bog'langan va davr qaytarishlari (posted) → zakaz × mahsulot qty. */
export async function loadReturnAllocs(
  tenantId: number,
  range: Range,
  lines: DatedFactLine[]
): Promise<{ allocs: ReturnAlloc[]; unallocated_qty: number; unallocated_count: number }> {
  const orderIds = [...new Set(lines.map((l) => l.order_id))];
  const allocs: ReturnAlloc[] = [];
  if (orderIds.length) {
    const rows = await prisma.$queryRaw<Array<{ order_id: number; product_id: number; qty: Prisma.Decimal }>>`
      SELECT sr.order_id, srl.product_id,
             SUM(COALESCE(srl.paid_qty, srl.qty - COALESCE(srl.bonus_qty, 0))) AS qty
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.return_id = sr.id
      WHERE sr.tenant_id = ${tenantId} AND sr.status = 'posted' AND sr.order_id = ANY(${orderIds}::int[])
      GROUP BY sr.order_id, srl.product_id`;
    for (const r of rows) allocs.push({ order_id: r.order_id, product_id: r.product_id, qty: Number(r.qty) });
  }

  const clientIds = [...new Set(lines.map((l) => l.client_id))];
  if (!clientIds.length) return { allocs, unallocated_qty: 0, unallocated_count: 0 };
  const periodRows = await prisma.$queryRaw<
    Array<{ return_id: number; client_id: number; date_from: Date; date_to: Date; product_id: number; qty: Prisma.Decimal }>
  >`
    SELECT sr.id AS return_id, sr.client_id, sr.date_from, sr.date_to, srl.product_id,
           SUM(COALESCE(srl.paid_qty, srl.qty - COALESCE(srl.bonus_qty, 0))) AS qty
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.return_id = sr.id
    WHERE sr.tenant_id = ${tenantId} AND sr.status = 'posted' AND sr.order_id IS NULL
      AND sr.client_id = ANY(${clientIds}::int[])
      AND sr.date_from IS NOT NULL AND sr.date_to IS NOT NULL
      AND sr.date_from < ${range.to} AND sr.date_to >= ${range.from}
    GROUP BY sr.id, sr.client_id, sr.date_from, sr.date_to, srl.product_id`;
  if (!periodRows.length) return { allocs, unallocated_qty: 0, unallocated_count: 0 };

  const minFrom = new Date(Math.min(...periodRows.map((r) => r.date_from.getTime())));
  const maxTo = new Date(Math.max(...periodRows.map((r) => r.date_to.getTime())) + 86_400_000);
  const candLines = await loadDeliveredLines(tenantId, { from: minFrom, to: maxTo }, {
    clientIds: [...new Set(periodRows.map((r) => r.client_id))]
  });
  const candidatesByReturn = new Map<number, PeriodCandidate[]>();
  for (const pr of periodRows) {
    if (candidatesByReturn.has(pr.return_id)) continue;
    const endExcl = pr.date_to.getTime() + 86_400_000;
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
  const res = allocatePeriodReturns(
    periodRows.map((r) => ({ return_id: r.return_id, client_id: r.client_id, product_id: r.product_id, qty: Number(r.qty) })),
    candidatesByReturn
  );
  const inMonth = new Set(orderIds);
  allocs.push(...res.allocs.filter((a) => inMonth.has(a.order_id)));
  return {
    allocs,
    unallocated_qty: res.unallocated.reduce((s, u) => s + u.qty, 0),
    unallocated_count: res.unallocated.length
  };
}

/** Oflayn zakazlarda `work_slot_id` yo'q bo'lsa — zakaz paytidagi o'rin oralig'i. */
async function fillMissingSlots(tenantId: number, lines: DatedFactLine[]): Promise<void> {
  const need = lines.filter((l) => l.work_slot_id == null && l.agent_id != null);
  if (!need.length) return;
  const agentIds = [...new Set(need.map((l) => l.agent_id!))];
  const links = await prisma.slotUserLink.findMany({
    where: { tenant_id: tenantId, user_id: { in: agentIds } },
    select: { user_id: true, slot_id: true, started_at: true, ended_at: true }
  });
  for (const l of need) {
    const t = l.created_at.getTime();
    const hit = links.find(
      (k) => k.user_id === l.agent_id && k.started_at.getTime() <= t && (!k.ended_at || k.ended_at.getTime() > t)
    );
    if (hit) l.work_slot_id = hit.slot_id;
  }
}

export type ExpeditorFact = { delivered_count: number; delivered_sum: number; delivered_volume: number; clients: number };

export type UserMonthFact = {
  agent: UserFact;
  bySlot: Map<number, UserFact>;
  expeditor: ExpeditorFact;
  team: UserFact | null;
  diagnostics: { unallocated_returns: number; multi_group_products: number };
};

function emptyFact(userId: number): UserFact {
  return { user_id: userId, work_slot_id: null, byGroup: new Map(), total: { ...ZERO_METRICS }, returned_sum: 0 };
}

async function teamLines(
  tenantId: number,
  userId: number,
  range: Range
): Promise<DatedFactLine[]> {
  const links = await prisma.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      user_id: userId,
      started_at: { lt: range.to },
      OR: [{ ended_at: null }, { ended_at: { gt: range.from } }]
    },
    select: { started_at: true, ended_at: true, slot: { select: { supervisee_agent_slot_ids: true } } }
  });
  const windows = links
    .filter((l) => l.slot.supervisee_agent_slot_ids.length > 0)
    .map((l) => ({
      from: Math.max(l.started_at.getTime(), range.from.getTime()),
      to: Math.min(l.ended_at?.getTime() ?? range.to.getTime(), range.to.getTime()),
      slots: new Set(l.slot.supervisee_agent_slot_ids)
    }));
  if (windows.length) {
    const slotIds = [...new Set(windows.flatMap((w) => [...w.slots]))];
    const lines = await loadDeliveredLines(tenantId, range, { slotIds });
    return lines.filter((l) =>
      windows.some(
        (w) =>
          l.work_slot_id != null && w.slots.has(l.work_slot_id) &&
          l.delivered_at.getTime() >= w.from && l.delivered_at.getTime() < w.to
      )
    );
  }
  const agents = await prisma.user.findMany({
    where: { tenant_id: tenantId, supervisor_user_id: userId, role: "agent" },
    select: { id: true }
  });
  if (!agents.length) return [];
  return loadDeliveredLines(tenantId, range, { agentIds: agents.map((a) => a.id) });
}

/** Bitta xodimning oy fakti: agent (o'rinlar bo'yicha ham), ekspeditor va supervayzer jamoasi. */
export async function computeUserMonthFact(
  tenantId: number,
  userId: number,
  role: string,
  range: Range,
  productGroups?: Map<number, number[]>
): Promise<UserMonthFact> {
  const groups = productGroups ?? (await loadProductGroups(tenantId));
  const multiGroup = [...groups.values()].filter((g) => g.length > 1).length;

  const agentLines = await loadDeliveredLines(tenantId, range, { agentIds: [userId] });
  await fillMissingSlots(tenantId, agentLines);
  const ret = await loadReturnAllocs(tenantId, range, agentLines);
  const agent = agentLines.length ? mergeUserFacts(agentLines, ret.allocs, groups, userId) : emptyFact(userId);
  const bySlot = new Map<number, UserFact>();
  for (const f of aggregateKpiFact(agentLines, ret.allocs, groups).values()) {
    if (f.user_id === userId && f.work_slot_id != null) bySlot.set(f.work_slot_id, f);
  }

  const expeditor: ExpeditorFact = { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 };
  if (role === "expeditor") {
    const ex = await loadDeliveredLines(tenantId, range, { expeditorIds: [userId] });
    const orders = new Set<number>();
    const clients = new Set<number>();
    for (const l of ex) {
      orders.add(l.order_id);
      clients.add(l.client_id);
      expeditor.delivered_sum += l.total;
      expeditor.delivered_volume += l.qty * l.volume_unit;
    }
    expeditor.delivered_count = orders.size;
    expeditor.clients = clients.size;
    expeditor.delivered_sum = Math.round(expeditor.delivered_sum * 100) / 100;
    expeditor.delivered_volume = Math.round(expeditor.delivered_volume * 100) / 100;
  }

  let team: UserFact | null = null;
  let teamUnalloc = 0;
  if (role === "supervisor") {
    const tl = await teamLines(tenantId, userId, range);
    const tr = await loadReturnAllocs(tenantId, range, tl);
    teamUnalloc = tr.unallocated_count;
    team = mergeUserFacts(tl.map((l) => ({ ...l, agent_id: userId })), tr.allocs, groups, userId);
  }

  return {
    agent,
    bySlot,
    expeditor,
    team,
    diagnostics: { unallocated_returns: ret.unallocated_count + teamUnalloc, multi_group_products: multiGroup }
  };
}

export type { KpiMetrics };
