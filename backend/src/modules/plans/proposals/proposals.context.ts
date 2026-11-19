import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_CONFIG,
  type DirectionContext,
  type EmployeeSource,
  type ProposalConfig,
  employeeKey
} from "@salec/plans-proposal";
import { prisma } from "../../../config/database";
import { fillMissingSlots, loadMonthReturnEvents } from "../../payroll/payroll-kpi-month";
import {
  loadDeliveredLines,
  loadOrphanReturns,
  loadProductGroups
} from "../../payroll/payroll-kpi-fact";
import {
  applyOrphanReturns,
  aggregateKpiFact,
  splitReturnEvents
} from "../../payroll/payroll-kpi-fact.pure";

import { getDirection, personName, USER_SELECT } from "../plans.setup.shared";
import { loadKpiGroupAgentLinks } from "../plans.setup.kpi-agents";
import { somToTiyin } from "./proposals.money";
import {
  daysInMonth,
  monthRangeUtc,
  previousPeriod,
  shiftPeriod,
  sourceMonthStatus,
  type Period
} from "./proposals.period";

export type ProposalContextPayload = {
  directions: Array<{ id: number; name: string; code: string | null }>;
  direction_id: number;
  target: Period;
  source: Period;
  source_meta: ReturnType<typeof sourceMonthStatus>;
  kpi_groups: Array<{ id: number; name: string }>;
  agent_kpi_ids: Record<string, number[]>;
  kpi_group_ids_with_agents: number[];
  datasets: Array<{ kpiGroupId: number; employees: EmployeeSource[] }>;
  snapshot_hash: string;
  default_configs: Record<string, ProposalConfig>;
};

async function listKpiGroups(tenantId: number, directionId: number) {
  const usedInPlans = await prisma.salesKpiPlan.findMany({
    where: { tenant_id: tenantId, trade_direction_id: directionId },
    select: { kpi_group_id: true },
    distinct: ["kpi_group_id"]
  });
  const fromAgents = await prisma.kpiGroupAgent.findMany({
    where: {
      kpi_group: { tenant_id: tenantId, is_active: true },
      user: {
        tenant_id: tenantId,
        is_active: true,
        OR: [{ trade_direction_id: directionId }, { trade_direction_id: null }]
      }
    },
    select: { kpi_group_id: true },
    distinct: ["kpi_group_id"]
  });
  const ids = new Set([
    ...usedInPlans.map((r) => r.kpi_group_id),
    ...fromAgents.map((r) => r.kpi_group_id)
  ]);
  const where =
    ids.size === 0
      ? { tenant_id: tenantId, is_active: true }
      : { tenant_id: tenantId, is_active: true, id: { in: [...ids] } };
  return prisma.kpiGroup.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true }
  });
}

async function loadAgents(tenantId: number, directionId: number, kpiGroupIds: number[]) {
  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: "agent",
      OR: [
        { trade_direction_id: directionId },
        { trade_direction_id: null },
        {
          kpi_group_links: {
            some: { kpi_group_id: { in: kpiGroupIds.length ? kpiGroupIds : [-1] } }
          }
        }
      ]
    },
    select: {
      ...USER_SELECT,
      supervisor: { select: { id: true, name: true, login: true, role: true } }
    }
  });
  return rows.filter(
    (u) => u.trade_direction_id === directionId || u.trade_direction_id == null
  );
}

async function loadApprovedPlans(
  tenantId: number,
  directionId: number,
  source: Period,
  kpiGroupIds: number[]
) {
  if (!kpiGroupIds.length) return new Map<string, { value: string; updatedAt: string }>();
  const plans = await prisma.salesKpiPlan.findMany({
    where: {
      tenant_id: tenantId,
      trade_direction_id: directionId,
      year: source.year,
      month: source.month,
      kpi_group_id: { in: kpiGroupIds },
      status: "approved"
    },
    select: {
      kpi_group_id: true,
      targets: {
        where: { status: "approved" },
        select: { user_id: true, cost: true, updated_at: true, work_slot_id: true }
      }
    }
  });
  const map = new Map<string, { value: string; updatedAt: string }>();
  for (const p of plans) {
    for (const t of p.targets) {
      const tiyin = somToTiyin(t.cost.toString());
      if (tiyin == null) continue;
      map.set(`${t.user_id}:${p.kpi_group_id}`, {
        value: tiyin,
        updatedAt: t.updated_at.toISOString()
      });
    }
  }
  return map;
}

function emptyContextPayload(
  directions: ProposalContextPayload["directions"],
  directionId: number,
  target: Period,
  source: Period
): ProposalContextPayload {
  return {
    directions,
    direction_id: directionId,
    target,
    source,
    source_meta: sourceMonthStatus(source),
    kpi_groups: [],
    agent_kpi_ids: {},
    kpi_group_ids_with_agents: [],
    datasets: [],
    snapshot_hash: "empty",
    default_configs: {}
  };
}

/** Read-only kontekst: ensurePlansAndTargets chaqirilmaydi. */
export async function buildProposalContext(
  tenantId: number,
  directionId: number,
  target: Period,
  sourceIn?: Period
): Promise<ProposalContextPayload> {
  const source = sourceIn ?? previousPeriod(target);
  const directions = await prisma.tradeDirection.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true }
  });
  const mappedDirs = directions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null }));
  if (!mappedDirs.length) {
    return emptyContextPayload(mappedDirs, directionId, target, source);
  }

  const resolvedId = mappedDirs.some((d) => d.id === directionId)
    ? directionId
    : mappedDirs[0]!.id;
  const direction = await getDirection(tenantId, resolvedId);
  if (!direction) {
    return emptyContextPayload(mappedDirs, resolvedId, target, source);
  }

  const sourceMeta = sourceMonthStatus(source);
  const kpiGroups = await listKpiGroups(tenantId, resolvedId);
  const kpiGroupIds = kpiGroups.map((g) => g.id);
  const [agents, kpiLinks, productGroups, prevPlans] = await Promise.all([
    loadAgents(tenantId, resolvedId, kpiGroupIds),
    loadKpiGroupAgentLinks(tenantId, kpiGroupIds),
    loadProductGroups(tenantId),
    loadApprovedPlans(tenantId, resolvedId, source, kpiGroupIds)
  ]);

  const agentIds = agents.map((a) => a.id);
  const range = monthRangeUtc(source);
  const allowedByUser = new Map<number, Set<number>>();
  for (const a of agents) {
    const linked = kpiLinks.agent_kpi_ids[String(a.id)];
    if (linked?.length) allowedByUser.set(a.id, new Set(linked));
  }

  const factByUserGroup = new Map<string, number>();
  if (agentIds.length && sourceMeta.observedDays > 0) {
    const lines = await loadDeliveredLines(tenantId, range, { agentIds });
    await fillMissingSlots(tenantId, lines);
    const returns = splitReturnEvents(
      await loadMonthReturnEvents(tenantId, range, { agentIds }, (a) => a != null && agentIds.includes(a)),
      range.from
    );
    const orphans = await loadOrphanReturns(tenantId, range, agentIds);
    const agg = aggregateKpiFact(
      lines,
      returns.sameMonth,
      productGroups,
      undefined,
      allowedByUser.size ? allowedByUser : undefined
    );
    for (const f of agg.values()) {
      const withOrphans = applyOrphanReturns(
        f,
        orphans.filter((o) => o.agent_id === f.user_id),
        productGroups,
        allowedByUser.get(f.user_id)
      );
      for (const [gid, metrics] of withOrphans.byGroup) {
        factByUserGroup.set(`${f.user_id}:${gid}`, metrics.cost);
      }
    }
  }

  const groupsWithAgents = new Set(kpiLinks.kpi_group_ids_with_agents);
  const datasets: ProposalContextPayload["datasets"] = [];
  const default_configs: Record<string, ProposalConfig> = {};

  for (const g of kpiGroups) {
    default_configs[String(g.id)] = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ProposalConfig;
    const employees: EmployeeSource[] = [];
    for (const a of agents) {
      const linkedIds = kpiLinks.agent_kpi_ids[String(a.id)];
      const linked =
        !groupsWithAgents.has(g.id) || (linkedIds != null && linkedIds.includes(g.id));
      const factSom = factByUserGroup.get(`${a.id}:${g.id}`);
      const factTiyin = factSom != null ? somToTiyin(factSom) : null;
      const prev = prevPlans.get(`${a.id}:${g.id}`);
      const hasFact = factTiyin != null;
      employees.push({
        employeeId: a.id,
        workSlotId: null,
        name: personName(a),
        code: a.code,
        role: a.role,
        branchId: 0,
        branch: (a.branch ?? "").trim() || "—",
        supervisorId:
          a.supervisor && String(a.supervisor.role ?? "").toLowerCase() === "supervisor"
            ? a.supervisor_user_id
            : null,
        supervisor:
          a.supervisor && String(a.supervisor.role ?? "").toLowerCase() === "supervisor"
            ? personName(a.supervisor)
            : "Без супервайзера",
        linked,
        active: true,
        fact: hasFact
          ? {
              status: sourceMeta.status,
              gross: factTiyin!,
              returns: "0",
              net: factTiyin!,
              observedDays: sourceMeta.observedDays,
              daysInMonth: sourceMeta.daysInMonth,
              updatedAt: new Date().toISOString()
            }
          : null,
        previousPlan: prev
          ? { status: "approved", value: prev.value, updatedAt: prev.updatedAt }
          : { status: "missing", value: "0", updatedAt: null },
        history: []
      });
    }
    datasets.push({ kpiGroupId: g.id, employees });
  }

  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        directionId: resolvedId,
        target,
        source,
        agents: agentIds,
        kpiGroupIds,
        facts: [...factByUserGroup.entries()],
        plans: [...prevPlans.entries()]
      })
    )
    .digest("hex")
    .slice(0, 40);

  return {
    directions: mappedDirs,
    direction_id: resolvedId,
    target,
    source,
    source_meta: sourceMeta,
    kpi_groups: kpiGroups,
    agent_kpi_ids: kpiLinks.agent_kpi_ids,
    kpi_group_ids_with_agents: kpiLinks.kpi_group_ids_with_agents,
    datasets,
    snapshot_hash: hash,
    default_configs
  };
}

export function toDirectionContext(
  tenantId: number,
  directionId: number,
  target: Period,
  source: Period
): DirectionContext {
  return {
    tenantId,
    directionId,
    target,
    source,
    metric: "cost"
  };
}

export { employeeKey, daysInMonth, shiftPeriod, Prisma };
