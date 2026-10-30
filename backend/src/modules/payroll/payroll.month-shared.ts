import { prisma } from "../../config/database";
import { tenantMonthRangeUtc } from "../../lib/workday-calendar";
import { loadPayrollUsers } from "./payroll.calc-context";
import type { PayrollUserSnapshot } from "./payroll.inputs";
import { snaps } from "./payroll.grid-month";
import type { GridSnap } from "./payroll.grid-month.pure";
import { loadDeliveredLines, loadOrphanReturns, loadProductGroups, type DatedFactLine } from "./payroll-kpi-fact";
import {
  aggregateKpiFact,
  applyOrphanReturns,
  mergeUserFacts,
  splitReturnEvents,
  ZERO_METRICS,
  type OrphanReturn,
  type ReturnEvent,
  type UserFact
} from "./payroll-kpi-fact.pure";
import { fillMissingSlots, LEADER_ROLES, loadMonthReturnEvents, teamScope } from "./payroll-kpi-month";
import type { ExpeditorFact, UserMonthFact } from "./payroll-kpi-month";
import { loadPlanMonthCache, type PlanMonthCache } from "./payroll-slot-plan";
import { prevYm } from "./payroll.dirty";

export type { UserMonthFact };

type Range = { from: Date; to: Date };

export type MonthFactCache = {
  groups: Map<number, number[]>;
  multiGroup: number;
  byAgent: Map<number, DatedFactLine[]>;
  byExpeditor: Map<number, DatedFactLine[]>;
  rawLines: DatedFactLine[];
  returns: ReturnEvent[];
  returnsByAgent: Map<number, ReturnEvent[]>;
  orphansByAgent: Map<number, OrphanReturn[]>;
  ownGroups: Map<number, Set<number>>;
};

export type CachedAssignment = {
  id: number;
  kpi_group_id: number;
  trade_direction_id: number;
  formula_id: number;
  formula_text_snapshot: string;
  target_item_id: number;
};

export type CachedOverride = { rule_code: string; amount: unknown; valid_from: number; valid_to: number | null };

export type BaseBundle = {
  emp: Map<number, { base_amount: unknown; currency: string | null; cash_desk_id: number | null; item_amounts: unknown } | null>;
  role: Map<string, { base_amount: unknown; currency: string; item_amounts: unknown } | null>;
  grids: GridSnap[];
};

export type PayrollMonthBundle = {
  facts: MonthFactCache;
  plans: PlanMonthCache;
  users: Map<number, PayrollUserSnapshot>;
  carry: Map<number, number>;
  salaryPaid: Map<number, number>;
  advances: Map<number, number>;
  monthFrozen: boolean;
  assignments: Map<number, CachedAssignment[]>;
  overrides: Map<number, CachedOverride[]>;
  bases: BaseBundle;
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const cur = map.get(key);
  if (cur) cur.push(value);
  else map.set(key, [value]);
}

function emptyFact(userId: number): UserFact {
  return { user_id: userId, work_slot_id: null, byGroup: new Map(), total: { ...ZERO_METRICS }, returned_sum: 0 };
}

/** Yetkazish, qaytarish va KPI a'zoligi — oy uchun bir marta. */
export async function loadMonthFactCache(tenantId: number, range: Range, userIds: number[]): Promise<MonthFactCache> {
  const groups = await loadProductGroups(tenantId);
  const rawLines = await loadDeliveredLines(tenantId, range, {});
  const filled = rawLines.map((l) => ({ ...l }));
  await fillMissingSlots(tenantId, filled);
  const returns = await loadMonthReturnEvents(tenantId, range, {}, () => true);
  const agentIds = new Set(userIds);
  for (const l of rawLines) if (l.agent_id != null) agentIds.add(l.agent_id);
  const [orphans, members] = await Promise.all([
    agentIds.size ? loadOrphanReturns(tenantId, range, [...agentIds]) : Promise.resolve([] as OrphanReturn[]),
    userIds.length
      ? prisma.kpiGroupAgent.findMany({
          where: { user_id: { in: userIds }, kpi_group: { tenant_id: tenantId, is_active: true } },
          select: { user_id: true, kpi_group_id: true }
        })
      : Promise.resolve([] as Array<{ user_id: number; kpi_group_id: number }>)
  ]);
  const byAgent = new Map<number, DatedFactLine[]>();
  const byExpeditor = new Map<number, DatedFactLine[]>();
  for (const l of filled) {
    if (l.agent_id != null) push(byAgent, l.agent_id, l);
    if (l.expeditor_user_id != null && !l.fully_returned) push(byExpeditor, l.expeditor_user_id, l);
  }
  const returnsByAgent = new Map<number, ReturnEvent[]>();
  for (const e of returns) if (e.agent_id != null) push(returnsByAgent, e.agent_id, e);
  const orphansByAgent = new Map<number, OrphanReturn[]>();
  for (const o of orphans) push(orphansByAgent, o.agent_id, o);
  const ownGroups = new Map<number, Set<number>>();
  for (const id of userIds) ownGroups.set(id, new Set());
  for (const m of members) {
    const set = ownGroups.get(m.user_id) ?? new Set<number>();
    set.add(m.kpi_group_id);
    ownGroups.set(m.user_id, set);
  }
  return {
    groups,
    multiGroup: [...groups.values()].filter((g) => g.length > 1).length,
    byAgent,
    byExpeditor,
    rawLines,
    returns,
    returnsByAgent,
    orphansByAgent,
    ownGroups
  };
}

function expeditorOf(lines: DatedFactLine[]): ExpeditorFact {
  const expeditor: ExpeditorFact = { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 };
  const orders = new Set<number>();
  const clients = new Set<number>();
  for (const l of lines) {
    orders.add(l.order_id);
    clients.add(l.client_id);
    expeditor.delivered_sum += l.total;
    expeditor.delivered_volume += l.qty * l.volume_unit;
  }
  expeditor.delivered_count = orders.size;
  expeditor.clients = clients.size;
  expeditor.delivered_sum = Math.round(expeditor.delivered_sum * 100) / 100;
  expeditor.delivered_volume = Math.round(expeditor.delivered_volume * 100) / 100;
  return expeditor;
}

/** Bir xodim fakti — oy keshi ichidan, qo'shimcha sotuv so'rovisiz. */
export async function userMonthFactFromCache(
  tenantId: number,
  userId: number,
  role: string,
  range: Range,
  cache: MonthFactCache
): Promise<UserMonthFact> {
  const ownGroups = cache.ownGroups.get(userId) ?? new Set<number>();
  const agentLines = cache.byAgent.get(userId) ?? [];
  const own = splitReturnEvents(cache.returnsByAgent.get(userId) ?? [], range.from);
  const orphans = [...(cache.orphansByAgent.get(userId) ?? []), ...own.earlier];
  const agent = applyOrphanReturns(
    agentLines.length ? mergeUserFacts(agentLines, own.sameMonth, cache.groups, userId, undefined, ownGroups) : emptyFact(userId),
    orphans,
    cache.groups,
    ownGroups
  );
  const bySlot = new Map<number, UserFact>();
  for (const f of aggregateKpiFact(agentLines, own.sameMonth, cache.groups, undefined, new Map([[userId, ownGroups]])).values()) {
    if (f.user_id !== userId || f.work_slot_id == null) continue;
    bySlot.set(f.work_slot_id, applyOrphanReturns(f, orphans.filter((o) => o.work_slot_id === f.work_slot_id), cache.groups, ownGroups));
  }

  let team: UserFact | null = null;
  let teamOrphans = 0;
  if (LEADER_ROLES.has(role)) {
    const scope = await teamScope(tenantId, userId, range);
    if (scope) {
      const tl = cache.rawLines.filter((l) => scope.match(l.agent_id, l.work_slot_id, l.delivered_at));
      const tr = splitReturnEvents(
        cache.returns.filter((e) => scope.match(e.agent_id, e.work_slot_id, e.return_at)),
        range.from
      );
      const teamAgents = [...new Set(tl.map((l) => l.agent_id).filter((x): x is number => x != null))];
      const to = teamAgents.flatMap((id) => cache.orphansByAgent.get(id) ?? []);
      teamOrphans = to.length;
      team = applyOrphanReturns(
        mergeUserFacts(tl.map((l) => ({ ...l, agent_id: userId })), tr.sameMonth, cache.groups, userId, undefined, ownGroups),
        [...to, ...tr.earlier],
        cache.groups,
        ownGroups
      );
    } else team = emptyFact(userId);
  }

  return {
    agent,
    bySlot,
    expeditor: role === "expeditor" ? expeditorOf(cache.byExpeditor.get(userId) ?? []) : { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 },
    team,
    diagnostics: { unallocated_returns: orphans.length + teamOrphans, multi_group_products: cache.multiGroup }
  };
}

/** Oy hisobi uchun umumiy ma'lumot: fakt, reja, oklad, formula, qoldiq. */
export async function loadPayrollMonthBundle(tenantId: number, year: number, month: number, userIds: number[], timeZone: string): Promise<PayrollMonthBundle> {
  const range = tenantMonthRangeUtc(year, month, timeZone);
  const prev = prevYm({ year, month });
  const [facts, plans, users, prevRows, pays, advancePays, period, assignments, overrides, emps, roles, grids] = await Promise.all([
    loadMonthFactCache(tenantId, range, userIds),
    loadPlanMonthCache(tenantId, year, month, range),
    loadPayrollUsers(tenantId, userIds),
    prisma.payrollRecord.findMany({
      where: { tenant_id: tenantId, user_id: { in: userIds }, year: prev.year, month: prev.month },
      select: { user_id: true, balance: true }
    }),
    prisma.payrollPayout.groupBy({
      by: ["user_id"],
      where: { tenant_id: tenantId, user_id: { in: userIds }, year, month, kind: "salary", status: "paid" },
      _sum: { amount_uzs: true }
    }),
    prisma.payrollPayout.groupBy({
      by: ["user_id"],
      where: { tenant_id: tenantId, user_id: { in: userIds }, year, month, kind: "advance", status: "paid" },
      _sum: { amount_uzs: true }
    }),
    prisma.payrollPeriod.findUnique({
      where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
      select: { status: true }
    }),
    prisma.payrollBonusAssignment.findMany({
      where: { tenant_id: tenantId, year, month, user_id: { in: userIds } },
      select: { id: true, user_id: true, kpi_group_id: true, trade_direction_id: true, formula_id: true, formula_text_snapshot: true, target_item_id: true }
    }),
    prisma.payrollSchemeOverride.findMany({
      where: { tenant_id: tenantId, user_id: { in: userIds } },
      select: { user_id: true, rule_code: true, amount: true, valid_from: true, valid_to: true }
    }),
    prisma.payrollEmployeeConfig.findMany({
      where: { tenant_id: tenantId, user_id: { in: userIds } },
      select: { user_id: true, base_amount: true, currency: true, cash_desk_id: true, item_amounts: true }
    }),
    prisma.payrollRoleConfig.findMany({
      where: { tenant_id: tenantId },
      select: { role: true, base_amount: true, currency: true, item_amounts: true }
    }),
    snaps(tenantId)
  ]);
  const carry = new Map<number, number>();
  for (const r of prevRows) {
    const b = Number(r.balance ?? 0);
    if (b < 0) carry.set(r.user_id, Math.round(-b * 100) / 100);
  }
  const salaryPaid = new Map<number, number>();
  for (const p of pays) salaryPaid.set(p.user_id, Number(p._sum.amount_uzs ?? 0));
  const advances = new Map<number, number>();
  for (const p of advancePays) advances.set(p.user_id, Number(p._sum.amount_uzs ?? 0));
  const assignMap = new Map<number, CachedAssignment[]>();
  for (const a of assignments) {
    push(assignMap, a.user_id, {
      id: a.id,
      kpi_group_id: a.kpi_group_id,
      trade_direction_id: a.trade_direction_id,
      formula_id: a.formula_id,
      formula_text_snapshot: a.formula_text_snapshot,
      target_item_id: a.target_item_id
    });
  }
  const overrideMap = new Map<number, CachedOverride[]>();
  for (const o of overrides) {
    push(overrideMap, o.user_id, { rule_code: o.rule_code, amount: o.amount, valid_from: o.valid_from, valid_to: o.valid_to });
  }
  const emp: BaseBundle["emp"] = new Map();
  for (const id of userIds) emp.set(id, null);
  for (const e of emps) emp.set(e.user_id, e);
  const role = new Map<string, { base_amount: unknown; currency: string; item_amounts: unknown } | null>();
  for (const r of roles) role.set(r.role, r);
  return {
    facts,
    plans,
    users,
    carry,
    salaryPaid,
    advances,
    monthFrozen: period?.status === "closed",
    assignments: assignMap,
    overrides: overrideMap,
    bases: { emp, role, grids }
  };
}
