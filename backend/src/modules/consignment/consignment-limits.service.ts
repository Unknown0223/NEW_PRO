import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { buildScopedAgentDirectoryWhereForActor } from "../access/access-agent-scope";
import {
  computeAgentConsignmentOutstanding,
  listConsignmentAgents,
  mirrorConsignmentPatchToActiveSlot,
  parseYearMonth,
  utcMonthStart
} from "./consignment.service";
import { proposeLimitFromPlan, proposeLimitFromSnapshot, type LimitRound } from "./consignment-limits.pure";

type Actor = { userId: number | null; role: string };

/** Xatolik kodi + mijozga ko‘rsatiladigan qo‘shimcha (masalan, ruxsat etilgan maksimum). */
export class ConsignmentLimitError extends Error {
  constructor(
    public code: string,
    public extra: Record<string, string> = {}
  ) {
    super(code);
  }
}

async function loadScopedAgents(tenantId: number, ids: number[], actor: Actor) {
  const scope = await buildScopedAgentDirectoryWhereForActor(tenantId, actor);
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "agent", is_active: true, id: { in: ids }, ...(scope ? { AND: [scope] } : {}) },
    select: {
      id: true,
      name: true,
      supervisor_user_id: true,
      consignment_limit_amount: true,
      consignment_ignore_previous_months_debt: true
    }
  });
  if (users.length !== new Set(ids).size) throw new ConsignmentLimitError("AGENT_OUT_OF_SCOPE");
  return new Map(users.map((u) => [u.id, u]));
}

async function setAgentLimit(tx: Prisma.TransactionClient, tenantId: number, userId: number, limit: Prisma.Decimal, now: Date) {
  await tx.user.update({ where: { id: userId }, data: { consignment_limit_amount: limit, consignment_updated_at: now } });
  await mirrorConsignmentPatchToActiveSlot(tx, tenantId, userId, { consignment_limit_amount: limit });
}

export type TransferInput = { from_user_id: number; to_user_id: number; amount: string };

/**
 * Bitta supervayzer ichida limitni bir agentdan boshqasiga o‘tkazish (umumiy summa o‘zgarmaydi).
 * Kamaytiriladigan summa ishlatilgan (to‘lanmagan) qismdan oshmasligi kerak.
 */
export async function transferConsignmentLimit(tenantId: number, input: TransferInput, actor: Actor) {
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isFinite() || amount.lte(0)) throw new ConsignmentLimitError("BAD_AMOUNT");
  if (input.from_user_id === input.to_user_id) throw new ConsignmentLimitError("SAME_AGENT");
  const agents = await loadScopedAgents(tenantId, [input.from_user_id, input.to_user_id], actor);
  const from = agents.get(input.from_user_id)!;
  const to = agents.get(input.to_user_id)!;
  if (from.supervisor_user_id !== to.supervisor_user_id) throw new ConsignmentLimitError("DIFFERENT_SUPERVISOR");

  const { year, month } = parseYearMonth(undefined);
  const monthStartsAt = utcMonthStart(year, month);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id IN (${from.id}, ${to.id}) FOR UPDATE`;
    const fresh = await tx.user.findMany({
      where: { id: { in: [from.id, to.id] } },
      select: { id: true, consignment_limit_amount: true, consignment_ignore_previous_months_debt: true }
    });
    const f = fresh.find((u) => u.id === from.id)!;
    const t = fresh.find((u) => u.id === to.id)!;
    if (f.consignment_limit_amount == null) throw new ConsignmentLimitError("SOURCE_NO_LIMIT");
    const outstanding = await computeAgentConsignmentOutstanding(tx, tenantId, f.id, {
      ignorePreviousMonthsDebt: f.consignment_ignore_previous_months_debt,
      monthStartsAt
    });
    const free = f.consignment_limit_amount.sub(outstanding);
    const available = free.gt(0) ? free : new Prisma.Decimal(0);
    if (amount.gt(available)) {
      throw new ConsignmentLimitError("AMOUNT_EXCEEDS_AVAILABLE", { max: available.toString() });
    }
    const fromAfter = f.consignment_limit_amount.sub(amount);
    const toBefore = t.consignment_limit_amount ?? new Prisma.Decimal(0);
    const toAfter = toBefore.add(amount);
    await setAgentLimit(tx, tenantId, f.id, fromAfter, now);
    await setAgentLimit(tx, tenantId, t.id, toAfter, now);
    return {
      from: { user_id: f.id, limit_before: f.consignment_limit_amount.toString(), limit_after: fromAfter.toString() },
      to: { user_id: t.id, limit_before: t.consignment_limit_amount?.toString() ?? null, limit_after: toAfter.toString() },
      amount: amount.toString()
    };
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actor.userId,
    entityType: AuditEntityType.user,
    entityId: from.id,
    action: "consignment.limit.transfer",
    payload: result
  });
  return result;
}

export type ProposalQuery = {
  source: "month" | "plan";
  year_month: string;
  percent?: number;
  round?: LimitRound;
  trade_direction_id: number;
  supervisor_user_id?: number;
  agents_without_supervisor?: boolean;
};

export type ProposalRow = {
  user_id: number;
  code: string | null;
  name: string;
  supervisor_name: string | null;
  consignment: boolean;
  current_limit: string | null;
  outstanding: string;
  basis: string | null;
  proposed_limit: string | null;
};

/** Sahifa ro‘yxatidagi agentlar uchun yangi limit taklifi: eski oy qiymati yoki reja summasining foizi. */
export async function buildConsignmentLimitProposal(tenantId: number, q: ProposalQuery, actor: Actor): Promise<ProposalRow[]> {
  const { data: agents } = await listConsignmentAgents(
    tenantId,
    {
      trade_direction_id: q.trade_direction_id,
      supervisor_user_id: q.supervisor_user_id,
      agents_without_supervisor: q.agents_without_supervisor
    },
    actor
  );
  if (agents.length === 0) return [];
  const ids = agents.map((a) => a.id);
  const { year, month } = parseYearMonth(q.year_month);
  const basisById = new Map<number, Prisma.Decimal | null>();

  if (q.source === "month") {
    const snaps = await prisma.consignmentLimitMonthly.findMany({
      where: { tenant_id: tenantId, user_id: { in: ids }, OR: [{ year: { lt: year } }, { year, month: { lte: month } }] },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { user_id: true, limit_amount: true }
    });
    for (const s of snaps) if (!basisById.has(s.user_id)) basisById.set(s.user_id, s.limit_amount);
  } else {
    const sums = await prisma.salesKpiPlanTarget.groupBy({
      by: ["user_id"],
      where: { tenant_id: tenantId, user_id: { in: ids }, plan: { year, month, trade_direction_id: q.trade_direction_id } },
      _sum: { cost: true }
    });
    for (const s of sums) basisById.set(s.user_id, s._sum.cost ?? new Prisma.Decimal(0));
  }

  return agents.map((a) => {
    const basis = basisById.get(a.id);
    const proposed =
      q.source === "month" ? proposeLimitFromSnapshot(basis ?? null) : proposeLimitFromPlan(basis ?? null, q.percent ?? 0, q.round ?? 1);
    return {
      user_id: a.id,
      code: a.work_slot_code ?? a.code,
      name: a.name,
      supervisor_name: a.supervisor_name,
      consignment: a.consignment,
      current_limit: a.consignment_limit_amount,
      outstanding: a.outstanding_debt,
      basis: basis != null ? basis.toString() : null,
      proposed_limit: proposed
    };
  });
}

/** Bir nechta agentga limitni bir yo‘la qo‘yish (konsignatsiya yoqilgan/o‘chirilgan holati o‘zgarmaydi). */
export async function applyConsignmentLimits(
  tenantId: number,
  rows: Array<{ user_id: number; limit_amount: string }>,
  actor: Actor,
  meta: Record<string, unknown>
) {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length !== rows.length) throw new ConsignmentLimitError("DUPLICATE_AGENT");
  const limits = rows.map((r) => ({ user_id: r.user_id, limit: new Prisma.Decimal(r.limit_amount) }));
  if (limits.some((r) => !r.limit.isFinite() || r.limit.lt(0))) throw new ConsignmentLimitError("BAD_AMOUNT");
  await loadScopedAgents(tenantId, ids, actor);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const r of limits) await setAgentLimit(tx, tenantId, r.user_id, r.limit, now);
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actor.userId,
    entityType: AuditEntityType.user,
    entityId: 0,
    action: "consignment.limit.apply",
    payload: { ...meta, user_ids: ids, count: ids.length }
  });
  return { updated: ids.length };
}
