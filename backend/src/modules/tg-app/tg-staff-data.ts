import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import { actorHasUnrestrictedDataScope, resolveAllowedAgentIdsForActor } from "../access/access-staff-scope";
import { computeAgentConsignmentOutstanding, parseYearMonth, utcMonthStart } from "../consignment/consignment.service";
import type { StaffIdentity } from "./tg-identity";
import { todayYmd, ymdToUtcEnd, ymdToUtcStart } from "./tg-ui.pure";

export type StaffScope = { agentIds: number[] | null; cashDeskIds: number[] | null; warehouseIds: number[] | null };

/** Xodim ko'ra oladigan agentlar / kassalar / omborlar (`null` — cheklovsiz). */
export async function loadStaffScope(id: StaffIdentity): Promise<StaffScope> {
  if (actorHasUnrestrictedDataScope(id.user.role)) return { agentIds: null, cashDeskIds: null, warehouseIds: null };
  const actor = await enrichScopedReportActor(id.tenantId, { userId: id.user.id, role: id.user.role });
  return {
    agentIds: resolveAllowedAgentIdsForActor(actor),
    cashDeskIds: [...new Set(actor.cash_desk_ids ?? [])],
    warehouseIds: [...new Set(actor.warehouse_ids ?? [])]
  };
}

function todayRange() {
  const ymd = todayYmd();
  return { start: ymdToUtcStart(ymd), end: ymdToUtcEnd(ymd) };
}

const agentFilter = (ids: number[] | null) => (ids === null ? {} : { agent_id: { in: ids } });

export async function loadSalesToday(tenantId: number, agentIds: number[] | null) {
  const { start, end } = todayRange();
  const base = { tenant_id: tenantId, order_type: "order", ...agentFilter(agentIds) } satisfies Prisma.OrderWhereInput;
  const [orders, newCount, delivering, delivered, payments, pendingPay] = await Promise.all([
    prisma.order.aggregate({
      where: { ...base, created_at: { gte: start, lte: end }, status: { notIn: ["cancelled", "pending_sync"] } },
      _count: true,
      _sum: { total_sum: true }
    }),
    prisma.order.count({ where: { ...base, status: "new" } }),
    prisma.order.count({ where: { ...base, status: "delivering" } }),
    prisma.order.aggregate({
      where: { ...base, status: "delivered", status_logs: { some: { to_status: "delivered", created_at: { gte: start, lte: end } } } },
      _count: true,
      _sum: { total_sum: true }
    }),
    prisma.payment.aggregate({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        entry_kind: "payment",
        workflow_status: { notIn: ["pending_confirmation", "rejected"] },
        created_at: { gte: start, lte: end },
        ...(agentIds === null ? {} : { client: { agent_id: { in: agentIds } } })
      },
      _count: true,
      _sum: { amount: true }
    }),
    prisma.payment.aggregate({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        workflow_status: "pending_confirmation",
        ...(agentIds === null ? {} : { client: { agent_id: { in: agentIds } } })
      },
      _count: true,
      _sum: { amount: true }
    })
  ]);
  return {
    ordersCount: orders._count,
    ordersSum: Number(orders._sum.total_sum ?? 0),
    newCount,
    delivering,
    deliveredCount: delivered._count,
    deliveredSum: Number(delivered._sum.total_sum ?? 0),
    paymentsCount: payments._count,
    paymentsSum: Number(payments._sum.amount ?? 0),
    pendingPayCount: pendingPay._count,
    pendingPaySum: Number(pendingPay._sum.amount ?? 0)
  };
}

/** Agentlar bo'yicha bugungi savdo (supervayzer / rahbar uchun reyting). */
export async function loadAgentsToday(tenantId: number, agentIds: number[]) {
  if (agentIds.length === 0) return [];
  const { start, end } = todayRange();
  const [agents, sums, visits] = await Promise.all([
    prisma.user.findMany({ where: { tenant_id: tenantId, id: { in: agentIds }, is_active: true }, select: { id: true, name: true } }),
    prisma.order.groupBy({
      by: ["agent_id"],
      where: {
        tenant_id: tenantId,
        order_type: "order",
        agent_id: { in: agentIds },
        created_at: { gte: start, lte: end },
        status: { notIn: ["cancelled", "pending_sync"] }
      },
      _sum: { total_sum: true },
      _count: true
    }),
    prisma.agentVisit.groupBy({
      by: ["agent_id"],
      where: { tenant_id: tenantId, agent_id: { in: agentIds }, checked_in_at: { gte: start, lte: end } },
      _count: true
    })
  ]);
  const sumBy = new Map(sums.map((s) => [s.agent_id, s]));
  const visitBy = new Map(visits.map((v) => [v.agent_id, v._count]));
  return agents
    .map((a) => ({
      id: a.id,
      name: a.name,
      sum: Number(sumBy.get(a.id)?._sum.total_sum ?? 0),
      orders: sumBy.get(a.id)?._count ?? 0,
      visits: visitBy.get(a.id) ?? 0
    }))
    .sort((a, b) => b.sum - a.sum);
}

export async function teamAgentIds(tenantId: number, supervisorId: number): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, supervisor_user_id: supervisorId, is_active: true, role: "agent" },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}

export async function loadMyConsignment(tenantId: number, userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { consignment: true, consignment_limit_amount: true, consignment_ignore_previous_months_debt: true }
  });
  if (!user) return null;
  const { year, month } = parseYearMonth(undefined);
  const outstanding = await computeAgentConsignmentOutstanding(prisma, tenantId, userId, {
    ignorePreviousMonthsDebt: user.consignment_ignore_previous_months_debt === true,
    monthStartsAt: utcMonthStart(year, month)
  });
  const rows = await prisma.$queryRaw<Array<{ id: number; number: string; client_name: string; due: Date | null; unpaid: Prisma.Decimal }>>`
    SELECT o.id, o.number, c.name AS client_name, o.consignment_due_date AS due,
      GREATEST(o.total_sum - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId} AND pa.order_id = o.id), 0), 0)::decimal(15,2) AS unpaid
    FROM orders o JOIN clients c ON c.id = o.client_id
    WHERE o.tenant_id = ${tenantId} AND o.agent_id = ${userId} AND o.order_type = 'order'
      AND o.is_consignment = true AND o.status = 'delivered'
    ORDER BY o.consignment_due_date ASC NULLS LAST
    LIMIT 300
  `;
  const open = rows.filter((r) => Number(r.unpaid) > 0.009);
  const now = Date.now();
  const overdue = open.filter((r) => r.due && r.due.getTime() < now);
  const dueSoon = open.filter((r) => r.due && r.due.getTime() >= now && r.due.getTime() < now + 3 * 86400_000);
  const limit = user.consignment_limit_amount != null ? Number(user.consignment_limit_amount) : null;
  return {
    enabled: user.consignment === true,
    limit,
    outstanding: Number(outstanding),
    free: limit != null ? Math.max(0, limit - Number(outstanding)) : null,
    overdue: overdue.map((r) => ({ ...r, unpaid: Number(r.unpaid) })),
    dueSoon: dueSoon.map((r) => ({ ...r, unpaid: Number(r.unpaid) }))
  };
}

export async function loadTopDebtors(tenantId: number, agentIds: number[] | null, take = 10) {
  const where: Prisma.ClientBalanceWhereInput = {
    tenant_id: tenantId,
    balance: { lt: 0 },
    client: { is_active: true, merged_into_client_id: null, ...(agentIds === null ? {} : { agent_id: { in: agentIds } }) }
  };
  const [agg, rows] = await Promise.all([
    prisma.clientBalance.aggregate({ where, _sum: { balance: true }, _count: true }),
    prisma.clientBalance.findMany({
      where,
      orderBy: { balance: "asc" },
      take,
      select: { balance: true, client: { select: { id: true, name: true, agent: { select: { name: true } } } } }
    })
  ]);
  return { total: Number(agg._sum.balance ?? 0), count: agg._count, rows };
}

export async function loadCashToday(tenantId: number, deskIds: number[] | null) {
  const { start, end } = todayRange();
  const deskWhere: Prisma.CashDeskWhereInput = { tenant_id: tenantId, is_active: true, ...(deskIds === null ? {} : { id: { in: deskIds } }) };
  const desks = await prisma.cashDesk.findMany({ where: deskWhere, select: { id: true, name: true, is_closed: true }, orderBy: { sort_order: "asc" }, take: 20 });
  if (desks.length === 0) return [];
  const ids = desks.map((d) => d.id);
  const [confirmed, pending] = await Promise.all([
    prisma.payment.groupBy({
      by: ["cash_desk_id"],
      where: {
        tenant_id: tenantId,
        cash_desk_id: { in: ids },
        deleted_at: null,
        workflow_status: { notIn: ["pending_confirmation", "rejected"] },
        created_at: { gte: start, lte: end }
      },
      _sum: { amount: true },
      _count: true
    }),
    prisma.payment.groupBy({
      by: ["cash_desk_id"],
      where: { tenant_id: tenantId, cash_desk_id: { in: ids }, deleted_at: null, workflow_status: "pending_confirmation" },
      _sum: { amount: true },
      _count: true
    })
  ]);
  const c = new Map(confirmed.map((r) => [r.cash_desk_id, r]));
  const p = new Map(pending.map((r) => [r.cash_desk_id, r]));
  return desks.map((d) => ({
    ...d,
    todaySum: Number(c.get(d.id)?._sum.amount ?? 0),
    todayCount: c.get(d.id)?._count ?? 0,
    pendingSum: Number(p.get(d.id)?._sum.amount ?? 0),
    pendingCount: p.get(d.id)?._count ?? 0
  }));
}

export async function loadStockSummary(tenantId: number, warehouseIds: number[] | null) {
  const whWhere: Prisma.WarehouseWhereInput = { tenant_id: tenantId, ...(warehouseIds === null ? {} : { id: { in: warehouseIds } }) };
  const warehouses = await prisma.warehouse.findMany({ where: whWhere, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 15 });
  if (warehouses.length === 0) return [];
  const ids = warehouses.map((w) => w.id);
  const [positive, reserved, zero] = await Promise.all([
    prisma.stock.groupBy({ by: ["warehouse_id"], where: { tenant_id: tenantId, warehouse_id: { in: ids }, qty: { gt: 0 } }, _count: true, _sum: { qty: true } }),
    prisma.stock.groupBy({ by: ["warehouse_id"], where: { tenant_id: tenantId, warehouse_id: { in: ids }, reserved_qty: { gt: 0 } }, _sum: { reserved_qty: true } }),
    prisma.stock.groupBy({
      by: ["warehouse_id"],
      where: { tenant_id: tenantId, warehouse_id: { in: ids }, qty: { lte: 0 }, product: { is_active: true } },
      _count: true
    })
  ]);
  const pos = new Map(positive.map((r) => [r.warehouse_id, r]));
  const res = new Map(reserved.map((r) => [r.warehouse_id, r]));
  const z = new Map(zero.map((r) => [r.warehouse_id, r._count]));
  return warehouses.map((w) => ({
    ...w,
    skus: pos.get(w.id)?._count ?? 0,
    qty: Number(pos.get(w.id)?._sum.qty ?? 0),
    reserved: Number(res.get(w.id)?._sum.reserved_qty ?? 0),
    outOfStock: z.get(w.id) ?? 0
  }));
}

export async function loadMyTasks(tenantId: number, userId: number) {
  return prisma.tenantTask.findMany({
    where: { tenant_id: tenantId, assignee_user_id: userId, status: { in: ["open", "in_progress"] } },
    orderBy: [{ due_at: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    take: 10,
    select: { id: true, title: true, status: true, due_at: true }
  });
}

export async function loadMyPayroll(tenantId: number, userId: number, year: number, month: number) {
  const [record, advances] = await Promise.all([
    prisma.payrollRecord.findUnique({
      where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: userId, year, month } },
      select: {
        base_salary: true,
        worked_days: true,
        allowances_total: true,
        deductions_total: true,
        advances_total: true,
        gross: true,
        paid_total: true,
        balance: true,
        status: true
      }
    }),
    prisma.payrollAdvance.findMany({
      where: { tenant_id: tenantId, user_id: userId, year, month, status: { notIn: ["cancelled", "draft"] } },
      select: { amount: true, status: true, created_at: true },
      orderBy: { created_at: "desc" },
      take: 5
    })
  ]);
  return { record, advances };
}
