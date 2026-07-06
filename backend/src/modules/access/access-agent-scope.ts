import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

/** Foydalanuvchi uchun agent ko‘rinish cheklovi (Доступ → Направления + SVR bog‘lanishi). */
export type AccessAgentScope = {
  supervisor_user_id: number | null;
  trade_direction_ids: number[];
};

export type ScopedReportActor = {
  userId: number | null;
  role: string;
  supervisor_user_id?: number | null;
  trade_direction_ids?: number[];
};

export async function loadAccessAgentScope(tenantId: number, userId: number): Promise<AccessAgentScope> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: {
      supervisor_user_id: true,
      trade_direction_links: { select: { trade_direction_id: true } }
    }
  });
  return {
    supervisor_user_id: u?.supervisor_user_id ?? null,
    trade_direction_ids: u?.trade_direction_links.map((x) => x.trade_direction_id) ?? []
  };
}

export async function enrichScopedReportActor(
  tenantId: number,
  actor: { userId: number | null; role: string }
): Promise<ScopedReportActor> {
  if (!actor.userId || (actor.role !== "manager" && actor.role !== "regional_manager")) {
    return { ...actor, supervisor_user_id: null, trade_direction_ids: [] };
  }
  const scope = await loadAccessAgentScope(tenantId, actor.userId);
  return { ...actor, ...scope };
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
  if ((actor?.role === "manager" || actor?.role === "regional_manager") && actor.userId) {
    const where: Prisma.UserWhereInput = {
      tenant_id: tenantId,
      role: "agent",
      is_active: true
    };
    if (actor.supervisor_user_id != null && actor.supervisor_user_id > 0) {
      where.supervisor_user_id = actor.supervisor_user_id;
    }
    const dirs = actor.trade_direction_ids ?? [];
    if (dirs.length > 0) {
      where.trade_direction_id = { in: dirs };
    }
    return where;
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
  if ((actor?.role === "manager" || actor?.role === "regional_manager") && actor.userId) {
    const parts: Prisma.Sql[] = [
      Prisma.sql`su.id = ${agentIdExpr}`,
      Prisma.sql`su.tenant_id = ${tenantId}`,
      Prisma.sql`su.role = 'agent'`,
      Prisma.sql`su.is_active = true`
    ];
    if (actor.supervisor_user_id != null && actor.supervisor_user_id > 0) {
      parts.push(Prisma.sql`su.supervisor_user_id = ${actor.supervisor_user_id}`);
    }
    const dirs = actor.trade_direction_ids ?? [];
    if (dirs.length > 0) {
      parts.push(Prisma.sql`su.trade_direction_id IN (${Prisma.join(dirs)})`);
    }
    return Prisma.sql`EXISTS (SELECT 1 FROM users su WHERE ${Prisma.join(parts, " AND ")})`;
  }
  return Prisma.sql`TRUE`;
}
