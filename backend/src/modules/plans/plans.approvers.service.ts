import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import {
  isApproverLeaderRole,
  isApproverLevelRole,
  APPROVER_LEADER_ROLES
} from "./plans.approvers.roles";
import { userMatchesTradeDirection } from "./plans.setup.direction";
import { collectSupervisorIdsWithFieldAgents, scopeApproverRowsByFieldAgents } from "./plans.setup.scope";

/** Dropdown/tanlov elementi. */
export type ApproverPerson = { id: number; name: string; role: string };

/** Yo'nalish (Направление торговли) tanlov elementi. */
export type ApproverDirection = { id: number; name: string; code: string | null };

export type ApproverOptions = {
  directions: ApproverDirection[];
  supervisors: ApproverPerson[];
  employees: ApproverPerson[];
  leaders: ApproverPerson[];
};

export type ApproverConfigRow = {
  supervisor_user_id: number;
  supervisor_name: string;
  levels: (number | null)[];
};

export type ApproverConfig = {
  rows: ApproverConfigRow[];
  leaders: number[];
};

export type SaveApproverInput = {
  rows: { supervisor_user_id: number; levels: (number | null)[] }[];
  leaders: number[];
};

function personName(u: { name: string | null; login: string }): string {
  const n = (u.name ?? "").trim();
  return n.length > 0 ? n : u.login;
}

/** Yo'nalishlar ro'yxati (faol), sort_order bo'yicha. */
async function listDirections(tenantId: number): Promise<ApproverDirection[]> {
  const rows = await prisma.tradeDirection.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true }
  });
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code ?? null }));
}

type UserRow = { id: number; name: string | null; login: string; role: string };

const USER_SELECT = { id: true, name: true, login: true, role: true } as const;
const USER_ORDER = [{ name: "asc" as const }, { login: "asc" as const }];

/** Prisma `in` ro‘yxati — `isApproverLevelRole` bilan bir xil. */
const APPROVER_LEVEL_ROLES_FILTER = [
  "manager",
  "sales_director",
  "commercial_director",
  "director",
  "admin",
  "operator",
  "regional_manager"
] as const;

/**
 * «Степень N» dropdownlari — faqat vebdan foydalanadigan savdo menejerlari.
 * Agentlar va mobil-only rollar chiqmaydi.
 */
async function listApproverLevelCandidates(
  tenantId: number,
  direction: ApproverDirection | null
): Promise<UserRow[]> {
  const baseWhere: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    role: { in: [...APPROVER_LEVEL_ROLES_FILTER] }
  };

  if (direction) {
    const values = [direction.name, direction.code].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    );
    if (values.length > 0) {
      const matched = await prisma.user.findMany({
        where: {
          ...baseWhere,
          OR: values.map((v) => ({ trade_direction: { equals: v, mode: "insensitive" as const } }))
        },
        orderBy: USER_ORDER,
        select: USER_SELECT
      });
      if (matched.length > 0) return matched;
    }
  }

  return prisma.user.findMany({
    where: baseWhere,
    orderBy: USER_ORDER,
    select: USER_SELECT
  });
}

/** Yo'nalishdagi maydon agentlari (FK yoki legacy matn). */
async function findFieldAgentsInDirection(
  tenantId: number,
  direction: ApproverDirection
): Promise<Array<{ supervisor_user_id: number | null; trade_direction_id: number | null; trade_direction: string | null }>> {
  const values = [direction.name, direction.code].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  const or: Prisma.UserWhereInput[] = [{ trade_direction_id: direction.id }];
  if (values.length > 0) {
    or.push(...values.map((v) => ({ trade_direction: { equals: v, mode: "insensitive" as const } })));
  }

  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: "agent",
      supervisor_user_id: { not: null },
      OR: or
    },
    select: {
      supervisor_user_id: true,
      trade_direction_id: true,
      trade_direction: true
    }
  });

  return rows.filter((a) => userMatchesTradeDirection(a, direction));
}

/** Faqat yo'nalish agentlari biriktirilgan supervayzerlar. */
async function listSupervisorsForDirection(
  tenantId: number,
  direction: ApproverDirection
): Promise<UserRow[]> {
  const agents = await findFieldAgentsInDirection(tenantId, direction);
  const supervisorIds = collectSupervisorIdsWithFieldAgents(agents);
  if (supervisorIds.size === 0) return [];

  return prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: "supervisor",
      id: { in: [...supervisorIds] }
    },
    orderBy: USER_ORDER,
    select: USER_SELECT
  });
}

/**
 * «Главные утверждающие» — direktorlar, admin va savdo menejerlari.
 */
async function listApproverLeaderCandidates(tenantId: number): Promise<UserRow[]> {
  return prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: { in: [...APPROVER_LEADER_ROLES] }
    },
    orderBy: USER_ORDER,
    select: USER_SELECT
  });
}

/**
 * Dropdownlar uchun tanlovlar.
 * - supervisors: faqat yo'nalishdagi agentlar biriktirilgan supervayzerlar.
 * - employees: «Степень N» uchun veb savdo menejerlari (agentlar emas).
 * - leaders: direktorlar, admin va menejerlar (asosiy utverjdayushiy).
 */
export async function listApproverOptions(
  tenantId: number,
  directionId: number | null
): Promise<ApproverOptions> {
  const direction =
    directionId == null
      ? null
      : await prisma.tradeDirection.findFirst({
          where: { id: directionId, tenant_id: tenantId },
          select: { id: true, name: true, code: true }
        });

  const supervisorQuery =
    direction != null
      ? listSupervisorsForDirection(tenantId, {
          id: direction.id,
          name: direction.name,
          code: direction.code ?? null
        })
      : prisma.user.findMany({
          where: { tenant_id: tenantId, is_active: true, role: "supervisor" },
          orderBy: USER_ORDER,
          select: USER_SELECT
        });

  const [directions, supervisors, employees, leaders] = await Promise.all([
    listDirections(tenantId),
    supervisorQuery,
    listApproverLevelCandidates(
      tenantId,
      direction ? { id: direction.id, name: direction.name, code: direction.code ?? null } : null
    ),
    listApproverLeaderCandidates(tenantId)
  ]);

  const toPerson = (u: UserRow): ApproverPerson => ({
    id: u.id,
    name: personName(u),
    role: u.role
  });

  let employeesOut = employees.map(toPerson);
  let leadersOut = leaders.map(toPerson);

  /** «Главный утверждающий» — «Степень» dagi SVR ustidagi xodimlar ham tanlanadi. */
  function mergeEmployeesIntoLeaders() {
    for (const p of employeesOut) {
      if (isApproverLeaderRole(p.role) && !leadersOut.some((x) => x.id === p.id)) {
        leadersOut.push(p);
      }
    }
    leadersOut.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  if (directionId != null) {
    const cfg = await getApproverConfig(tenantId, directionId);
    const extraIds = new Set<number>();
    for (const id of cfg.leaders) extraIds.add(id);
    for (const row of cfg.rows) {
      for (const lvl of row.levels) if (lvl != null) extraIds.add(lvl);
    }
    const known = new Set([
      ...employeesOut.map((e) => e.id),
      ...leadersOut.map((e) => e.id)
    ]);
    const missing = [...extraIds].filter((id) => !known.has(id));
    if (missing.length > 0) {
      const extra = await prisma.user.findMany({
        where: { tenant_id: tenantId, id: { in: missing } },
        select: USER_SELECT
      });
      for (const u of extra) {
        const p = toPerson(u);
        if (isApproverLeaderRole(u.role) && !leadersOut.some((x) => x.id === p.id)) {
          leadersOut.push(p);
        } else if (!employeesOut.some((x) => x.id === p.id)) {
          employeesOut.push(p);
        }
      }
    }
  }

  mergeEmployeesIntoLeaders();

  return {
    directions,
    supervisors: supervisors.map(toPerson),
    employees: employeesOut,
    leaders: leadersOut
  };
}

/** Tenant bo'yicha umumiy rahbarlar ro'yxati (tartibli). */
async function getLeaders(tenantId: number): Promise<number[]> {
  const rows = await prisma.planApproverLeader.findMany({
    where: { tenant_id: tenantId },
    orderBy: { position: "asc" },
    select: { leader_user_id: true }
  });
  return rows.map((r) => r.leader_user_id);
}

/** Tanlangan yo'nalish uchun saqlangan zanjir + tenant rahbarlari. */
export async function getApproverConfig(
  tenantId: number,
  directionId: number
): Promise<ApproverConfig> {
  const direction = await prisma.tradeDirection.findFirst({
    where: { id: directionId, tenant_id: tenantId },
    select: { id: true, name: true, code: true }
  });

  const [configs, leaders] = await Promise.all([
    prisma.planApproverConfig.findMany({
      where: { tenant_id: tenantId, direction_id: directionId },
      select: {
        supervisor_user_id: true,
        supervisor: { select: { name: true, login: true } },
        levels: {
          orderBy: { position: "asc" },
          select: { position: true, approver_user_id: true }
        }
      }
    }),
    getLeaders(tenantId)
  ]);

  let rows: ApproverConfigRow[] = configs.map((c) => ({
    supervisor_user_id: c.supervisor_user_id,
    supervisor_name: personName(c.supervisor),
    levels: c.levels
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((l) => l.approver_user_id ?? null)
  }));

  if (direction) {
    const agents = await findFieldAgentsInDirection(tenantId, {
      id: direction.id,
      name: direction.name,
      code: direction.code ?? null
    });
    rows = scopeApproverRowsByFieldAgents(rows, agents);
  }

  return { rows, leaders };
}

/** Yo'nalish va barcha bog'liq userlar tenantga tegishliligini tekshirish. */
async function assertReferencesValid(
  tenantId: number,
  directionId: number,
  input: SaveApproverInput
): Promise<void> {
  const dir = await prisma.tradeDirection.findFirst({
    where: { id: directionId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!dir) throw new Error("BAD_DIRECTION");

  const userIds = new Set<number>();
  for (const row of input.rows) {
    userIds.add(row.supervisor_user_id);
    for (const lvl of row.levels) if (lvl != null) userIds.add(lvl);
  }
  for (const id of input.leaders) userIds.add(id);

  if (userIds.size === 0) return;

  const found = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: [...userIds] } },
    select: { id: true, role: true }
  });
  if (found.length !== userIds.size) throw new Error("BAD_USER");

  for (const id of input.leaders) {
    const u = found.find((r) => r.id === id);
    if (!u || !isApproverLeaderRole(u.role)) throw new Error("BAD_LEADER_ROLE");
  }

  for (const row of input.rows) {
    const sup = found.find((r) => r.id === row.supervisor_user_id);
    if (!sup || sup.role !== "supervisor") throw new Error("BAD_SUPERVISOR");
    for (const lvl of row.levels) {
      if (lvl == null) continue;
      const u = found.find((r) => r.id === lvl);
      if (!u || !isApproverLevelRole(u.role)) throw new Error("BAD_LEVEL_ROLE");
    }
  }
}

/**
 * Tanlangan yo'nalish uchun zanjirni to'liq almashtirish (replace) +
 * tenant rahbarlarini almashtirish. Hammasi bitta transaction ichida.
 */
export async function saveApproverConfig(
  tenantId: number,
  directionId: number,
  input: SaveApproverInput,
  actorUserId?: number | null
): Promise<ApproverConfig> {
  await assertReferencesValid(tenantId, directionId, input);

  // Bir supervayzer faqat bir marta (oxirgi yozuv ustun).
  const bySupervisor = new Map<number, (number | null)[]>();
  for (const row of input.rows) bySupervisor.set(row.supervisor_user_id, row.levels);

  // Rahbarlar — dedupe, tartib saqlanadi.
  const leaderIds: number[] = [];
  const seenLeader = new Set<number>();
  for (const id of input.leaders) {
    if (!seenLeader.has(id)) {
      seenLeader.add(id);
      leaderIds.push(id);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.planApproverConfig.deleteMany({
      where: { tenant_id: tenantId, direction_id: directionId }
    });

    for (const [supervisorUserId, levels] of bySupervisor) {
      await tx.planApproverConfig.create({
        data: {
          tenant_id: tenantId,
          direction_id: directionId,
          supervisor_user_id: supervisorUserId,
          levels: {
            create: levels.map((approverUserId, position) => ({
              tenant_id: tenantId,
              position,
              approver_user_id: approverUserId ?? null
            }))
          }
        }
      });
    }

    await tx.planApproverLeader.deleteMany({ where: { tenant_id: tenantId } });
    if (leaderIds.length > 0) {
      await tx.planApproverLeader.createMany({
        data: leaderIds.map((leaderUserId, position) => ({
          tenant_id: tenantId,
          position,
          leader_user_id: leaderUserId
        }))
      });
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    entityType: "plans",
    entityId: directionId,
    action: "plans.approvers.save",
    payload: {
      direction_id: directionId,
      rows: input.rows.length,
      leaders: leaderIds.length
    }
  });

  return getApproverConfig(tenantId, directionId);
}
