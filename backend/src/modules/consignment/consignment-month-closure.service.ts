import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  parseConsignmentMonthCloseDay,
  resolveAgentConsignmentCloseSchedule,
  utcConsignmentPeriodCloseAt,
  utcDayStart,
  utcMonthEndExclusive,
  type ConsignmentCloseSchedule
} from "./consignment-settings";
import { utcMonthStart } from "./consignment.service";
import {
  findAgentConsignmentMonthStatus,
  upsertAgentConsignmentMonthStatus
} from "./consignment-month-status.repo";

/** Shu oy ichidagi konsignatsiya zakazlari bo‘yicha qolgan qarz (limit flagidan mustaqil). */
export async function computeAgentMonthConsignmentDebt(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  agentId: number,
  year: number,
  month: number
): Promise<Prisma.Decimal> {
  const monthStartsAt = utcMonthStart(year, month);
  const monthEndsAt = utcMonthEndExclusive(year, month);

  const orders = await db.order.findMany({
    where: {
      tenant_id: tenantId,
      agent_id: agentId,
      is_consignment: true,
      order_type: "order",
      status: { in: [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE] },
      created_at: { gte: monthStartsAt, lt: monthEndsAt }
    },
    select: { id: true, total_sum: true }
  });

  if (orders.length === 0) return new Prisma.Decimal(0);

  const ids = orders.map((o) => o.id);
  const totalById = new Map(orders.map((o) => [o.id, o.total_sum]));

  const allocGroups = await db.paymentAllocation.groupBy({
    by: ["order_id"],
    where: { tenant_id: tenantId, order_id: { in: ids } },
    _sum: { amount: true }
  });
  const allocMap = new Map<number, Prisma.Decimal>();
  for (const g of allocGroups) {
    if (g.order_id != null) allocMap.set(g.order_id, g._sum.amount ?? new Prisma.Decimal(0));
  }

  const payGroups = await db.payment.groupBy({
    by: ["order_id"],
    where: {
      tenant_id: tenantId,
      order_id: { in: ids },
      entry_kind: "payment",
      workflow_status: "confirmed",
      deleted_at: null
    },
    _sum: { amount: true }
  });
  const payMap = new Map<number, Prisma.Decimal>();
  for (const g of payGroups) {
    if (g.order_id != null) payMap.set(g.order_id, g._sum.amount ?? new Prisma.Decimal(0));
  }

  let outstanding = new Prisma.Decimal(0);
  for (const oid of ids) {
    const total = totalById.get(oid) ?? new Prisma.Decimal(0);
    const alloc = allocMap.get(oid) ?? new Prisma.Decimal(0);
    const paid = alloc.gt(0) ? alloc : payMap.get(oid) ?? new Prisma.Decimal(0);
    const unpaid = total.sub(paid);
    if (unpaid.gt(0)) outstanding = outstanding.add(unpaid);
  }
  return outstanding;
}

export type AgentMonthClosureSnapshot = {
  period_closed_at: Date | null;
  debt_cleared_at: Date | null;
};

/** Bitta agent + oy uchun yopilish va qarz yopilgan sanalarni yangilash (idempotent). */
export async function reconcileAgentConsignmentMonthClosure(
  tenantId: number,
  agentUserId: number,
  year: number,
  month: number,
  schedule: ConsignmentCloseSchedule,
  now: Date = new Date()
): Promise<AgentMonthClosureSnapshot> {
  const periodCloseAt = utcConsignmentPeriodCloseAt(year, month, schedule);
  const pastCloseDay = now >= periodCloseAt;

  const existing = await findAgentConsignmentMonthStatus(tenantId, agentUserId, year, month);

  let periodClosedAt = existing?.period_closed_at ?? null;
  let debtClearedAt = existing?.debt_cleared_at ?? null;

  if (pastCloseDay && periodClosedAt == null) {
    periodClosedAt = periodCloseAt;
  }

  if (periodClosedAt != null && debtClearedAt == null) {
    const debt = await computeAgentMonthConsignmentDebt(prisma, tenantId, agentUserId, year, month);
    if (debt.lte(0)) {
      debtClearedAt = utcDayStart(now);
    }
  }

  if (!existing && periodClosedAt == null && debtClearedAt == null) {
    return { period_closed_at: null, debt_cleared_at: null };
  }

  const row = await upsertAgentConsignmentMonthStatus({
    tenant_id: tenantId,
    agent_user_id: agentUserId,
    year,
    month,
    period_closed_at: periodClosedAt,
    debt_cleared_at: debtClearedAt
  });

  return {
    period_closed_at: row.period_closed_at,
    debt_cleared_at: row.debt_cleared_at
  };
}

/** Tenant agentlari uchun oy yopilishini sinxronlashtirish. */
export async function reconcileTenantConsignmentMonthClosures(
  tenantId: number,
  yearMonth: string,
  agentIds?: number[]
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) return;

  const [ys, ms] = yearMonth.split("-");
  const year = Number(ys);
  const month = Number(ms);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return;

  const where: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    role: "agent",
    is_active: true,
    consignment: true
  };
  if (agentIds?.length) where.id = { in: agentIds };

  const agents = await prisma.user.findMany({
    where,
    select: {
      id: true,
      consignment_close_day: true,
      consignment_close_hour: true,
      consignment_close_minute: true
    }
  });
  const now = new Date();
  for (const a of agents) {
    const schedule = resolveAgentConsignmentCloseSchedule(a, tenant.settings);
    await reconcileAgentConsignmentMonthClosure(tenantId, a.id, year, month, schedule, now);
  }
}

/** Barcha tenantlar — kunlik cron. */
export async function reconcileAllTenantsConsignmentClosures(now: Date = new Date()): Promise<void> {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const tenants = await prisma.tenant.findMany({
    where: { is_active: true },
    select: { id: true }
  });

  for (const t of tenants) {
    await reconcileTenantConsignmentMonthClosures(t.id, yearMonth).catch((err) => {
      console.error(`[consignment-closure-cron] tenant ${t.id}:`, err);
    });
  }
}

/** Guruh (supervisor) — barcha agentlar qarzini yopganda oxirgi sana. */
export function computeSupervisorGroupDebtClearedAt(
  rows: ReadonlyArray<{ debt_cleared_at: Date | string | null }>
): Date | null {
  if (rows.length === 0) return null;
  let max: Date | null = null;
  for (const r of rows) {
    if (r.debt_cleared_at == null) return null;
    const d = r.debt_cleared_at instanceof Date ? r.debt_cleared_at : new Date(r.debt_cleared_at);
    if (Number.isNaN(d.getTime())) return null;
    if (max == null || d > max) max = d;
  }
  return max;
}
