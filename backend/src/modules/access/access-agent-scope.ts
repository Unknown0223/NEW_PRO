import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { isOperatorLikeWebRole } from "../../lib/tenant-user-roles";

/** Foydalanuvchi uchun agent ko‘rinish cheklovi (Доступ → Сотрудники / SVR bog‘lanishi). */
export type AccessAgentScope = {
  /** Agentlar shu user ga `supervisor_user_id` orqali bog‘langan. */
  bound_agent_ids: number[];
  trade_direction_ids: number[];
};

export type ScopedReportActor = {
  userId: number | null;
  role: string;
  bound_agent_ids?: number[];
  trade_direction_ids?: number[];
};

export async function loadAccessAgentScope(tenantId: number, userId: number): Promise<AccessAgentScope> {
  const [u, boundAgents] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: {
        trade_direction_links: { select: { trade_direction_id: true } }
      }
    }),
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: "agent",
        is_active: true,
        supervisor_user_id: userId
      },
      select: { id: true }
    })
  ]);
  return {
    bound_agent_ids: boundAgents.map((a) => a.id),
    trade_direction_ids: u?.trade_direction_links.map((x) => x.trade_direction_id) ?? []
  };
}

/**
 * Operator / manager / supervisor: Access «Сотрудники» orqali bog‘langan agentlar.
 * Bog‘lanish yo‘q operator-like — bo‘sh ro‘yxat (katalog to‘liq emas).
 */
export async function enrichScopedReportActor(
  tenantId: number,
  actor: { userId: number | null; role: string }
): Promise<ScopedReportActor> {
  if (!actor.userId) {
    return { ...actor, bound_agent_ids: [], trade_direction_ids: [] };
  }
  const role = actor.role;
  const needsScope =
    role === "supervisor" ||
    role === "agent" ||
    isOperatorLikeWebRole(role);
  if (!needsScope) {
    return { ...actor, bound_agent_ids: [], trade_direction_ids: [] };
  }
  const scope = await loadAccessAgentScope(tenantId, actor.userId);
  return { ...actor, ...scope };
}

/**
 * Ruxsat etilgan agent id lari.
 * `null` — cheklov yo‘q (admin / scope bo‘lmagan rol).
 * `[]` — hech narsa ko‘rinmasin.
 */
export function resolveAllowedAgentIdsForActor(actor: ScopedReportActor): number[] | null {
  if (!actor.userId || actor.role === "admin") return null;
  if (actor.role === "agent") return [actor.userId];
  if (actor.role === "supervisor" || isOperatorLikeWebRole(actor.role)) {
    return [...(actor.bound_agent_ids ?? [])];
  }
  return null;
}

/**
 * So‘ralgan agent_ids ni Access doirasi bilan kesishadi.
 * Scope bo‘lsa va so‘rov bo‘sh bo‘lsa — faqat bound id lar qaytadi (filtr default).
 */
export function intersectRequestedAgentIds(
  requested: number[] | undefined,
  actor: ScopedReportActor
): { agentIds: number[]; restricted: boolean } {
  const allowed = resolveAllowedAgentIdsForActor(actor);
  const req = [...new Set((requested ?? []).filter((n) => Number.isFinite(n) && n > 0))];
  if (allowed === null) {
    return { agentIds: req, restricted: false };
  }
  if (req.length > 0) {
    return { agentIds: req.filter((id) => allowed.includes(id)), restricted: true };
  }
  return { agentIds: allowed, restricted: true };
}

/** Mijozlar: asosiy agent yoki assignment orqali Access doirasida. */
export function buildClientAgentScopeWhere(actor: ScopedReportActor): Prisma.ClientWhereInput | null {
  const allowed = resolveAllowedAgentIdsForActor(actor);
  if (allowed === null) return null;
  if (allowed.length === 0) return { id: { in: [] } };
  return {
    OR: [{ agent_id: { in: allowed } }, { agent_assignments: { some: { agent_id: { in: allowed } } } }]
  };
}

/** Mijoz detal / IDOR: Access «Сотрудники» doirasida emas → xato. */
export async function assertClientAllowedForActor(
  tenantId: number,
  clientId: number,
  actor: { userId: number | null; role: string }
): Promise<void> {
  const enriched = await enrichScopedReportActor(tenantId, actor);
  const scopeWhere = buildClientAgentScopeWhere(enriched);
  if (scopeWhere === null) return;
  const found = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, AND: [scopeWhere] },
    select: { id: true }
  });
  if (!found) {
    throw new Error("CLIENT_OUT_OF_SCOPE");
  }
}

/** Hisobotlar va filtrlarda agent ro‘yxati uchun WHERE. */
export function buildScopedAgentWhere(
  tenantId: number,
  actor?: ScopedReportActor
): Prisma.UserWhereInput {
  if (actor?.role === "agent" && actor.userId) {
    return { tenant_id: tenantId, id: actor.userId, is_active: true };
  }
  if (actor?.role === "supervisor" && actor.userId) {
    return { tenant_id: tenantId, role: "agent", supervisor_user_id: actor.userId, is_active: true };
  }
  if (actor?.userId && isOperatorLikeWebRole(actor.role)) {
    const bound = actor.bound_agent_ids ?? [];
    if (bound.length > 0) {
      return { tenant_id: tenantId, role: "agent", id: { in: bound }, is_active: true };
    }
    // Access bog‘lanishi yo‘q — bo‘sh (orders/directory bilan bir xil).
    return { tenant_id: tenantId, role: "agent", id: { in: [] }, is_active: true };
  }
  return { tenant_id: tenantId, role: "agent", is_active: true };
}

export async function buildScopedAgentWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput> {
  if (!actor) return buildScopedAgentWhere(tenantId);
  const enriched = await enrichScopedReportActor(tenantId, actor);
  return buildScopedAgentWhere(tenantId, enriched);
}

/**
 * Staff directory (`GET /agents`): Access «Сотрудники» binds only.
 * Unlike report filters — operator-like with zero binds sees an empty list (safer than all).
 * Does not force `is_active` so inactive directory rows remain filterable.
 * Returns `null` when the actor may see the full agent catalog (admin / unbound roles).
 */
export function buildScopedAgentDirectoryWhere(
  _tenantId: number,
  actor?: ScopedReportActor
): Prisma.UserWhereInput | null {
  if (!actor?.userId) return null;
  if (actor.role === "admin") return null;

  if (actor.role === "agent") {
    return { id: actor.userId };
  }
  if (actor.role === "supervisor") {
    return { supervisor_user_id: actor.userId };
  }
  if (isOperatorLikeWebRole(actor.role)) {
    const bound = actor.bound_agent_ids ?? [];
    if (bound.length > 0) {
      return { id: { in: bound } };
    }
    // Zero Access binds → empty directory (do not fall back to all agents).
    return { id: { in: [] } };
  }
  return null;
}

export async function buildScopedAgentDirectoryWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput | null> {
  if (!actor?.userId) return null;
  if (actor.role === "admin") return null;

  if (actor.role === "agent") {
    return { id: actor.userId };
  }
  if (actor.role === "supervisor") {
    return { supervisor_user_id: actor.userId };
  }
  if (isOperatorLikeWebRole(actor.role)) {
    // Directory: include inactive bound agents (report scope keeps active-only).
    const boundAgents = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: "agent",
        supervisor_user_id: actor.userId
      },
      select: { id: true }
    });
    const bound = boundAgents.map((a) => a.id);
    if (bound.length > 0) {
      return { id: { in: bound } };
    }
    return { id: { in: [] } };
  }
  return null;
}

/**
 * Buyurtmalar / detal / yozish: Access «Сотрудники» chegarasi.
 * `null` — cheklov yo‘q (admin yoki scope qo‘llanmaydigan rol).
 * Operator-like / supervisor: bog‘langan agentlar; bog‘lanish yo‘q → bo‘sh (`agent_id in []`).
 */
export function buildOrderAgentScopeWhere(actor: ScopedReportActor): Prisma.OrderWhereInput | null {
  if (!actor.userId || actor.role === "admin") return null;
  if (actor.role === "agent") {
    return { agent_id: actor.userId };
  }
  if (actor.role === "supervisor" || isOperatorLikeWebRole(actor.role)) {
    const bound = actor.bound_agent_ids ?? [];
    return { agent_id: { in: bound } };
  }
  return null;
}

/** Buyurtma agent_id shu actor doirasidami. */
export function isOrderAgentAllowedForActor(
  agentId: number | null | undefined,
  actor: ScopedReportActor
): boolean {
  if (!actor.userId || actor.role === "admin") return true;
  if (actor.role === "agent") {
    return agentId != null && agentId === actor.userId;
  }
  if (actor.role === "supervisor" || isOperatorLikeWebRole(actor.role)) {
    if (agentId == null || agentId < 1) return false;
    const bound = actor.bound_agent_ids ?? [];
    return bound.includes(agentId);
  }
  return true;
}

export async function assertOrderAgentAllowedForActor(
  tenantId: number,
  agentId: number | null | undefined,
  actor: { userId: number | null; role: string }
): Promise<void> {
  const enriched = await enrichScopedReportActor(tenantId, actor);
  if (!isOrderAgentAllowedForActor(agentId, enriched)) {
    throw new Error("AGENT_OUT_OF_SCOPE");
  }
}

/** SQL: agent ustuni shu actor ko‘rish chegarasida (hisobotlar). */
export function buildScopedAgentExistsSql(
  tenantId: number,
  agentIdExpr: Prisma.Sql,
  actor?: ScopedReportActor
): Prisma.Sql {
  if (actor?.role === "agent" && actor.userId) {
    return Prisma.sql`${agentIdExpr} = ${actor.userId}`;
  }
  if (actor?.role === "supervisor" && actor.userId) {
    return Prisma.sql`EXISTS (
      SELECT 1 FROM users su
      WHERE su.id = ${agentIdExpr}
        AND su.tenant_id = ${tenantId}
        AND su.supervisor_user_id = ${actor.userId}
    )`;
  }
  if (actor?.userId && isOperatorLikeWebRole(actor.role)) {
    const bound = actor.bound_agent_ids ?? [];
    if (bound.length > 0) {
      return Prisma.sql`${agentIdExpr} IN (${Prisma.join(bound)})`;
    }
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`TRUE`;
}
