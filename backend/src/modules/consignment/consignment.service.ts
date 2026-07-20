import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { buildScopedAgentDirectoryWhereForActor } from "../access/access-agent-scope";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  parseConsignmentMonthCloseDay,
  patchConsignmentSettings,
  resolveAgentConsignmentCloseSchedule
} from "./consignment-settings";
import { reconcileTenantConsignmentMonthClosures } from "./consignment-month-closure.service";
import { listAgentConsignmentMonthStatusForMonth } from "./consignment-month-status.repo";
import { userWhereTradeDirection } from "./consignment-trade-direction";

export type ConsignmentOutstandingOptions = {
  ignorePreviousMonthsDebt: boolean;
  /** UTC: hisobot oyi 1-kuni 00:00 */
  monthStartsAt: Date;
};

/** `YYYY-MM` yoki bo‘sh — joriy oy */
export function parseYearMonth(raw: string | undefined): { year: number; month: number } {
  const t = raw?.trim();
  if (t && /^\d{4}-\d{2}$/.test(t)) {
    const [ys, ms] = t.split("-");
    const year = Number(ys);
    const month = Number(ms);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return { year, month };
  }
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function utcMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

/**
 * Zakaz bo‘yicha to‘langan summa: avvalo `payment_allocations`, bo‘sh bo‘lsa `order_id` li to‘lovlar.
 */
export async function computeAgentConsignmentOutstanding(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  agentId: number,
  opts: ConsignmentOutstandingOptions
): Promise<Prisma.Decimal> {
  const orders = await db.order.findMany({
    where: {
      tenant_id: tenantId,
      agent_id: agentId,
      is_consignment: true,
      order_type: "order",
      /** «Балансы по консигнации» bilan bir xil: faqat доставлен (mijoz olgach). */
      status: { in: [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE] }
    },
    select: { id: true, total_sum: true, created_at: true }
  });

  const filtered = orders.filter((o) => {
    if (!opts.ignorePreviousMonthsDebt) return true;
    return o.created_at >= opts.monthStartsAt;
  });

  if (filtered.length === 0) return new Prisma.Decimal(0);

  const ids = filtered.map((o) => o.id);
  const totalById = new Map(filtered.map((o) => [o.id, o.total_sum]));

  const allocGroups = await db.paymentAllocation.groupBy({
    by: ["order_id"],
    where: { tenant_id: tenantId, order_id: { in: ids } },
    _sum: { amount: true }
  });
  const allocMap = new Map<number, Prisma.Decimal>();
  for (const g of allocGroups) {
    if (g.order_id != null) {
      allocMap.set(g.order_id, g._sum.amount ?? new Prisma.Decimal(0));
    }
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
    if (g.order_id != null) {
      payMap.set(g.order_id, g._sum.amount ?? new Prisma.Decimal(0));
    }
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

export type ConsignmentAgentRow = {
  id: number;
  code: string | null;
  work_slot_code: string | null;
  name: string;
  is_active: boolean;
  consignment: boolean;
  consignment_limit_amount: string | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_updated_at: string | null;
  /** Oy yopilgan sana (tenant `month_close_day` bo‘yicha avtomatik) */
  consignment_period_closed_at: string | null;
  /** Shu oy konsignatsiya qarzi to‘liq yopilgan sana (yopilishdan keyin avtomatik) */
  consignment_debt_cleared_at: string | null;
  consignment_close_day: number;
  consignment_close_hour: number;
  consignment_close_minute: number;
  supervisor_user_id: number | null;
  supervisor_name: string | null;
  outstanding_debt: string;
  remaining_limit: string | null;
};

export type ConsignmentListMeta = {
  month_close_day: number;
};

export type ConsignmentSettings = {
  month_close_day: number;
};

export type ListConsignmentAgentsQuery = {
  year_month?: string;
  trade_direction_id?: number;
  supervisor_user_id?: number;
  /** `true` — faqat `supervisor_user_id === null` agentlar */
  agents_without_supervisor?: boolean;
  consignment?: "all" | "yes" | "no";
  search?: string;
  /** `true` — yopilish sanalarini sinxronlash (sekin; «Обновить» uchun) */
  sync_closures?: boolean;
};

function toFio(u: {
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  name: string;
}): string {
  const parts = [u.last_name, u.first_name, u.middle_name].filter((x) => x && x.trim().length > 0);
  return parts.length > 0 ? parts.join(" ") : u.name;
}

export async function getConsignmentSettings(tenantId: number): Promise<ConsignmentSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  return { month_close_day: parseConsignmentMonthCloseDay(tenant?.settings) };
}

export async function patchConsignmentSettingsForTenant(
  tenantId: number,
  monthCloseDay: number,
  actorUserId: number | null
): Promise<ConsignmentSettings> {
  if (!Number.isInteger(monthCloseDay) || monthCloseDay < 1 || monthCloseDay > 31) {
    throw new Error("BAD_CLOSE_DAY");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: patchConsignmentSettings(tenant.settings, monthCloseDay) }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.tenant_settings,
    entityId: tenantId,
    action: "consignment.settings.update",
    payload: { month_close_day: monthCloseDay }
  });

  return { month_close_day: monthCloseDay };
}

export async function listConsignmentAgents(
  tenantId: number,
  q: ListConsignmentAgentsQuery,
  actor?: { userId: number | null; role: string }
): Promise<{ data: ConsignmentAgentRow[]; meta: ConsignmentListMeta }> {
  const { year, month } = parseYearMonth(q.year_month);
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const monthStartsAt = utcMonthStart(year, month);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const tenantSettings = tenant?.settings;
  const settings = { month_close_day: parseConsignmentMonthCloseDay(tenantSettings) };
  if (q.sync_closures) {
    try {
      await reconcileTenantConsignmentMonthClosures(tenantId, yearMonth);
    } catch (err) {
      console.error("[consignment] sync_closures failed:", err);
    }
  }

  const closureRows = await listAgentConsignmentMonthStatusForMonth(tenantId, year, month);
  const closureByAgent = new Map(
    closureRows.map((r) => [
      r.agent_user_id,
      { period: r.period_closed_at, cleared: r.debt_cleared_at }
    ])
  );

  const where: Prisma.UserWhereInput = { tenant_id: tenantId, role: "agent", is_active: true };
  const c = q.consignment ?? "all";
  if (c === "yes") where.consignment = true;
  else if (c === "no") where.consignment = false;
  if (q.agents_without_supervisor === true) {
    where.supervisor_user_id = null;
  } else if (q.supervisor_user_id != null && q.supervisor_user_id > 0) {
    where.supervisor_user_id = q.supervisor_user_id;
  }

  const andExtra: Prisma.UserWhereInput[] = [];
  const scopeWhere = await buildScopedAgentDirectoryWhereForActor(tenantId, actor);
  if (scopeWhere) andExtra.push(scopeWhere);
  if (q.trade_direction_id != null && q.trade_direction_id > 0) {
    andExtra.push(await userWhereTradeDirection(tenantId, q.trade_direction_id));
  }
  const s = q.search?.trim();
  if (s) {
    andExtra.push({
      OR: [
        { name: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
        { first_name: { contains: s, mode: "insensitive" } },
        { last_name: { contains: s, mode: "insensitive" } }
      ]
    });
  }
  if (andExtra.length > 0) where.AND = andExtra;

  const users = await prisma.user.findMany({
    where,
    include: { supervisor: { select: { name: true } } },
    orderBy: [{ code: "asc" }, { id: "asc" }]
  });

  const { loadActiveWorkSlotsByUserIds } = await import("../work-slots/work-slots.query");
  const workSlotByUser = await loadActiveWorkSlotsByUserIds(users.map((u) => u.id));

  const rows: ConsignmentAgentRow[] = [];
  for (const u of users) {
    const ignore = u.consignment_ignore_previous_months_debt;
    const outstanding = await computeAgentConsignmentOutstanding(prisma, tenantId, u.id, {
      ignorePreviousMonthsDebt: ignore,
      monthStartsAt
    });
    const limitAmt = u.consignment_limit_amount;
    let remaining: string | null = null;
    if (limitAmt != null) {
      const rem = limitAmt.sub(outstanding);
      remaining = (rem.gt(0) ? rem : new Prisma.Decimal(0)).toString();
    }
    const closure = closureByAgent.get(u.id);
    const closeSchedule = resolveAgentConsignmentCloseSchedule(u, tenantSettings);
    rows.push({
      id: u.id,
      code: u.code,
      work_slot_code: workSlotByUser.get(u.id)?.slot_code ?? null,
      name: toFio(u),
      is_active: u.is_active,
      consignment: u.consignment,
      consignment_limit_amount: limitAmt?.toString() ?? null,
      consignment_ignore_previous_months_debt: ignore,
      consignment_updated_at: u.consignment_updated_at?.toISOString() ?? null,
      consignment_period_closed_at: closure?.period?.toISOString() ?? null,
      consignment_debt_cleared_at: closure?.cleared?.toISOString() ?? null,
      consignment_close_day: closeSchedule.day,
      consignment_close_hour: closeSchedule.hour,
      consignment_close_minute: closeSchedule.minute,
      supervisor_user_id: u.supervisor_user_id,
      supervisor_name: u.supervisor?.name ?? null,
      outstanding_debt: outstanding.toString(),
      remaining_limit: remaining
    });
  }

  return { data: rows, meta: { month_close_day: settings.month_close_day } };
}

export type BulkPatchConsignmentInput = {
  user_ids: number[];
  consignment?: boolean;
  consignment_limit_amount?: string | null;
  consignment_ignore_previous_months_debt?: boolean;
};

export async function bulkPatchConsignmentAgents(
  tenantId: number,
  input: BulkPatchConsignmentInput,
  actorUserId: number | null
): Promise<{ updated: number }> {
  const ids = [...new Set(input.user_ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) throw new Error("EMPTY_IDS");
  if (ids.length > 500) throw new Error("TOO_MANY_IDS");

  const data: Prisma.UserUpdateManyMutationInput = {
    consignment_updated_at: new Date()
  };
  if (input.consignment !== undefined) data.consignment = input.consignment;
  if (input.consignment_ignore_previous_months_debt !== undefined) {
    data.consignment_ignore_previous_months_debt = input.consignment_ignore_previous_months_debt;
  }
  if (input.consignment_limit_amount !== undefined) {
    if (input.consignment_limit_amount == null || String(input.consignment_limit_amount).trim() === "") {
      data.consignment_limit_amount = null;
      data.consignment_ignore_previous_months_debt = false;
    } else {
      const d = new Prisma.Decimal(input.consignment_limit_amount);
      if (d.lt(0)) throw new Error("BAD_LIMIT");
      data.consignment_limit_amount = d;
    }
  }

  const hasField =
    input.consignment !== undefined ||
    input.consignment_limit_amount !== undefined ||
    input.consignment_ignore_previous_months_debt !== undefined;
  if (!hasField) throw new Error("EMPTY_PATCH");

  const res = await prisma.user.updateMany({
    where: { tenant_id: tenantId, role: "agent", is_active: true, id: { in: ids } },
    data
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: 0,
    action: "bulk.consignation",
    payload: { user_ids: ids, keys: Object.keys(data).filter((k) => k !== "consignment_updated_at") }
  });

  return { updated: res.count };
}

export type ConsignmentAgentRowPatch = {
  user_id: number;
  consignment: boolean;
  consignment_limit_amount: string | null;
  consignment_ignore_previous_months_debt: boolean;
};

/**
 * Bir nechta agent uchun konsignatsiya sozlamalarini bitta tranzaksiyada yangilash
 * (har qator uchun alohida HTTP o‘rniga bitta so‘rov).
 */
export async function bulkPatchConsignmentAgentRows(
  tenantId: number,
  rows: ConsignmentAgentRowPatch[],
  actorUserId: number | null
): Promise<{ updated: number }> {
  const seen = new Set<number>();
  const cleaned: ConsignmentAgentRowPatch[] = [];
  for (const r of rows) {
    if (!Number.isInteger(r.user_id) || r.user_id <= 0) continue;
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    cleaned.push(r);
  }
  if (cleaned.length === 0) throw new Error("EMPTY_ROWS");
  if (cleaned.length > 500) throw new Error("TOO_MANY_ROWS");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const row of cleaned) {
      let limitAmt: Prisma.Decimal | null = null;
      if (
        row.consignment_limit_amount != null &&
        String(row.consignment_limit_amount).trim() !== ""
      ) {
        const d = new Prisma.Decimal(row.consignment_limit_amount);
        if (d.lt(0)) throw new Error("BAD_LIMIT");
        limitAmt = d;
      }
      const ignoreDebt =
        limitAmt == null || !row.consignment ? false : row.consignment_ignore_previous_months_debt;

      const res = await tx.user.updateMany({
        where: { id: row.user_id, tenant_id: tenantId, role: "agent", is_active: true },
        data: {
          consignment: row.consignment,
          consignment_limit_amount: limitAmt,
          consignment_ignore_previous_months_debt: ignoreDebt,
          consignment_updated_at: now
        }
      });
      if (res.count !== 1) throw new Error("BAD_AGENT_ROW");
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: 0,
    action: "bulk.consignation_rows",
    payload: { user_ids: cleaned.map((r) => r.user_id), count: cleaned.length }
  });

  return { updated: cleaned.length };
}
