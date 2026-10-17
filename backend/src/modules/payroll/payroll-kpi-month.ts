import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  allocatePeriodRows,
  filterSql,
  loadDeliveredLines,
  loadOrphanReturns,
  loadProductGroups,
  PAID_QTY,
  type DatedFactLine,
  type LineFilter
} from "./payroll-kpi-fact";
import {
  aggregateKpiFact,
  applyOrphanReturns,
  mergeUserFacts,
  splitReturnEvents,
  ZERO_METRICS,
  type ReturnEvent,
  type UserFact
} from "./payroll-kpi-fact.pure";

type Range = { from: Date; to: Date };

/**
 * Oy ichida bo'lgan qaytarishlar (qaytarish oyiga yoziladi):
 * zakazga bog'langan qaytarishlar, `sales_returns` yozuvisiz to'liq qaytarilgan zakazlar (status logi sanasi)
 * va zakazga taqsimlangan davr qaytarishlari. Taqsimlanmagani — `loadOrphanReturns`.
 */
export async function loadMonthReturnEvents(
  tenantId: number,
  range: Range,
  f: LineFilter,
  keep: (agentId: number | null, slotId: number | null, at: Date) => boolean
): Promise<ReturnEvent[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      order_id: number;
      product_id: number;
      qty: Prisma.Decimal;
      return_at: Date;
      agent_id: number | null;
      work_slot_id: number | null;
      delivered_at: Date;
      unit_price: Prisma.Decimal | null;
      volume_unit: Prisma.Decimal;
    }>
  >`
    WITH ev AS (
      SELECT sr.order_id, srl.product_id, ${PAID_QTY} AS qty, sr.created_at AS return_at
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.return_id = sr.id
      JOIN orders o ON o.id = sr.order_id
      WHERE sr.tenant_id = ${tenantId} AND sr.status <> 'cancelled' AND sr.order_id IS NOT NULL
        AND sr.created_at >= ${range.from} AND sr.created_at < ${range.to}
        ${filterSql(f)}
      GROUP BY sr.id, sr.order_id, srl.product_id, sr.created_at
      UNION ALL
      SELECT o.id, oi.product_id, SUM(oi.qty), rl.returned_at
      FROM orders o
      JOIN LATERAL (
        SELECT MAX(l.created_at) AS returned_at FROM order_status_logs l
        WHERE l.order_id = o.id AND l.to_status = 'returned' AND l.superseded_at IS NULL
      ) rl ON rl.returned_at >= ${range.from} AND rl.returned_at < ${range.to}
      JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
      WHERE o.tenant_id = ${tenantId} AND o.order_type = 'order' AND o.status = 'returned'
        AND NOT EXISTS (SELECT 1 FROM sales_returns sr WHERE sr.order_id = o.id AND sr.status <> 'cancelled')
        ${filterSql(f)}
      GROUP BY o.id, oi.product_id, rl.returned_at
    )
    SELECT ev.order_id, ev.product_id, ev.qty, ev.return_at, o.agent_id, o.work_slot_id, dl.delivered_at,
           li.unit_price, COALESCE(p.volume_m3, 0) AS volume_unit
    FROM ev
    JOIN orders o ON o.id = ev.order_id
    JOIN LATERAL (
      SELECT MAX(l.created_at) AS delivered_at FROM order_status_logs l
      WHERE l.order_id = o.id AND l.to_status = 'delivered' AND l.superseded_at IS NULL
    ) dl ON dl.delivered_at IS NOT NULL
    JOIN LATERAL (
      SELECT SUM(oi.total) / NULLIF(SUM(oi.qty), 0) AS unit_price FROM order_items oi
      WHERE oi.order_id = o.id AND oi.product_id = ev.product_id AND oi.is_bonus = false
    ) li ON true
    JOIN products p ON p.id = ev.product_id`;
  const events: ReturnEvent[] = rows.map((r) => ({
    order_id: r.order_id,
    product_id: r.product_id,
    qty: Number(r.qty),
    return_at: r.return_at,
    agent_id: r.agent_id,
    work_slot_id: r.work_slot_id,
    delivered_at: r.delivered_at,
    unit_price: Number(r.unit_price ?? 0),
    volume_unit: Number(r.volume_unit)
  }));

  const periodRows = await prisma.$queryRaw<
    Array<{ return_id: number; client_id: number; date_from: Date; date_to: Date; created_at: Date; product_id: number; qty: Prisma.Decimal }>
  >`
    SELECT sr.id AS return_id, sr.client_id, sr.date_from, sr.date_to, sr.created_at, srl.product_id, ${PAID_QTY} AS qty
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.return_id = sr.id
    WHERE sr.tenant_id = ${tenantId} AND sr.status <> 'cancelled' AND sr.order_id IS NULL AND sr.client_id IS NOT NULL
      AND sr.date_from IS NOT NULL AND sr.date_to IS NOT NULL
      AND sr.created_at >= ${range.from} AND sr.created_at < ${range.to}
    GROUP BY sr.id, sr.client_id, sr.date_from, sr.date_to, sr.created_at, srl.product_id`;
  if (periodRows.length) {
    const { allocs, candLines } = await allocatePeriodRows(
      tenantId,
      periodRows.map((r) => ({ ...r, qty: Number(r.qty) }))
    );
    const lineOf = new Map(candLines.map((l) => [`${l.order_id}:${l.product_id}`, l]));
    const createdOf = new Map(periodRows.map((r) => [r.return_id, r.created_at]));
    for (const a of allocs) {
      const l = lineOf.get(`${a.order_id}:${a.product_id}`);
      if (!l) continue;
      events.push({
        order_id: a.order_id,
        product_id: a.product_id,
        qty: a.qty,
        return_at: (a.return_id != null ? createdOf.get(a.return_id) : undefined) ?? range.from,
        agent_id: l.agent_id,
        work_slot_id: l.work_slot_id,
        delivered_at: l.delivered_at,
        unit_price: l.qty > 0 ? l.total / l.qty : 0,
        volume_unit: l.volume_unit
      });
    }
  }
  return events.filter((e) => keep(e.agent_id, e.work_slot_id, e.return_at));
}

/** Oflayn zakazlarda `work_slot_id` yo'q bo'lsa — zakaz paytidagi o'rin oralig'i. */
export async function fillMissingSlots(tenantId: number, lines: DatedFactLine[]): Promise<void> {
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

export const LEADER_ROLES = new Set(["supervisor", "manager", "regional_manager", "sales_director", "director"]);

async function memberGroups(tenantId: number, userId: number): Promise<Set<number>> {
  const rows = await prisma.kpiGroupAgent.findMany({
    where: { user_id: userId, kpi_group: { tenant_id: tenantId, is_active: true } },
    select: { kpi_group_id: true }
  });
  return new Set(rows.map((r) => r.kpi_group_id));
}

type TeamScope = { filter: LineFilter; match: (agentId: number | null, slotId: number | null, at: Date) => boolean } | null;

/** Supervayzer jamoasi: ish o'rni bog'lanish oynalari (bo'lmasa — `supervisor_user_id` agentlari). */
export async function teamScope(tenantId: number, userId: number, range: Range): Promise<TeamScope> {
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
    return {
      filter: { slotIds: [...new Set(windows.flatMap((w) => [...w.slots]))] },
      match: (_a, slotId, at) =>
        slotId != null && windows.some((w) => w.slots.has(slotId) && at.getTime() >= w.from && at.getTime() < w.to)
    };
  }
  const people = await prisma.user.findMany({
    where: { tenant_id: tenantId, supervisor_user_id: userId },
    select: { id: true, role: true }
  });
  const ids = new Set(people.filter((p) => p.role === "agent").map((p) => p.id));
  const leaders = people.filter((p) => p.role !== "agent").map((p) => p.id);
  if (leaders.length) {
    const nested = await prisma.user.findMany({
      where: { tenant_id: tenantId, role: "agent", supervisor_user_id: { in: leaders } },
      select: { id: true }
    });
    for (const n of nested) ids.add(n.id);
  }
  if (!ids.size) return null;
  return { filter: { agentIds: [...ids] }, match: (agentId) => agentId != null && ids.has(agentId) };
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
  const ownGroups = await memberGroups(tenantId, userId);

  const agentLines = await loadDeliveredLines(tenantId, range, { agentIds: [userId] });
  await fillMissingSlots(tenantId, agentLines);
  const own = splitReturnEvents(
    await loadMonthReturnEvents(tenantId, range, { agentIds: [userId] }, (a) => a === userId),
    range.from
  );
  const orphans = [...(await loadOrphanReturns(tenantId, range, [userId])), ...own.earlier];
  const agent = applyOrphanReturns(
    agentLines.length ? mergeUserFacts(agentLines, own.sameMonth, groups, userId, undefined, ownGroups) : emptyFact(userId),
    orphans,
    groups,
    ownGroups
  );
  const bySlot = new Map<number, UserFact>();
  for (const f of aggregateKpiFact(agentLines, own.sameMonth, groups, undefined, new Map([[userId, ownGroups]])).values()) {
    if (f.user_id !== userId || f.work_slot_id == null) continue;
    const slotId = f.work_slot_id;
    bySlot.set(slotId, applyOrphanReturns(f, orphans.filter((o) => o.work_slot_id === slotId), groups, ownGroups));
  }

  const expeditor: ExpeditorFact = { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 };
  if (role === "expeditor") {
    const ex = (await loadDeliveredLines(tenantId, range, { expeditorIds: [userId] })).filter((l) => !l.fully_returned);
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
  let teamOrphans = 0;
  if (LEADER_ROLES.has(role)) {
    const scope = await teamScope(tenantId, userId, range);
    if (scope) {
      const tl = (await loadDeliveredLines(tenantId, range, scope.filter)).filter((l) =>
        scope.match(l.agent_id, l.work_slot_id, l.delivered_at)
      );
      const tr = splitReturnEvents(await loadMonthReturnEvents(tenantId, range, scope.filter, scope.match), range.from);
      const teamAgents = [...new Set(tl.map((l) => l.agent_id).filter((x): x is number => x != null))];
      const to = await loadOrphanReturns(tenantId, range, teamAgents);
      teamOrphans = to.length;
      team = applyOrphanReturns(
        mergeUserFacts(tl.map((l) => ({ ...l, agent_id: userId })), tr.sameMonth, groups, userId, undefined, ownGroups),
        [...to, ...tr.earlier],
        groups,
        ownGroups
      );
    } else {
      team = emptyFact(userId);
    }
  }

  return {
    agent,
    bySlot,
    expeditor,
    team,
    diagnostics: { unallocated_returns: orphans.length + teamOrphans, multi_group_products: multiGroup }
  };
}
