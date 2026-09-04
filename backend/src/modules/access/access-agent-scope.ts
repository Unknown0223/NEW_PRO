import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  EMPTY_ACCESS_SCOPE,
  actorHasUnrestrictedDataScope,
  buildClientAgentScopeWhere,
  buildScopedAgentWhere,
  buildScopedStaffDirectoryWhere,
  isOrderAgentAllowedForActor,
  resolveVisibleStaffIds,
  uniquePositiveIds,
  type AccessAgentScope,
  type ScopedReportActor
} from "./access-staff-scope";

export type { AccessAgentScope, ScopedReportActor } from "./access-staff-scope";
export {
  buildActorPaymentGrantOr,
  buildClientAgentScopeWhere,
  buildOrderAgentScopeWhere,
  buildScopedAgentDirectoryWhere,
  buildScopedAgentExistsSql,
  buildScopedAgentWhere,
  buildScopedStaffDirectoryWhere,
  intersectRequestedAgentIds,
  isOrderAgentAllowedForActor,
  resolveAllowedAgentIdsForActor,
  resolveVisibleStaffIds
} from "./access-staff-scope";

export type LoadAccessScopeOpts = {
  /** Staff katalogi — neaktiv qatorlar ham. Hisobotlar — faqat faol. */
  includeInactive?: boolean;
};

async function listStaffIdsLinkedToTerritories(
  tenantId: number,
  territoryIds: number[],
  opts: { includeInactive: boolean }
): Promise<number[]> {
  if (territoryIds.length === 0) return [];
  const [linkRows, territories] = await Promise.all([
    prisma.territoryUserLink.findMany({
      where: { territory_id: { in: territoryIds }, territory: { tenant_id: tenantId } },
      select: { user_id: true }
    }),
    prisma.territory.findMany({
      where: { tenant_id: tenantId, id: { in: territoryIds }, deleted_at: null },
      select: { name: true, code: true }
    })
  ]);
  const ids = new Set(uniquePositiveIds(linkRows.map((l) => l.user_id)));
  const terms = [
    ...new Set(
      territories.flatMap((t) => [t.name?.trim(), t.code?.trim()]).filter((s): s is string => Boolean(s))
    )
  ];
  if (terms.length > 0) {
    const stringMatches = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        ...(opts.includeInactive ? {} : { is_active: true }),
        OR: terms.flatMap((term) => [
          { territory: { equals: term, mode: "insensitive" } },
          { territory: { contains: term, mode: "insensitive" } }
        ])
      },
      select: { id: true }
    });
    for (const r of stringMatches) ids.add(r.id);
  }
  if (ids.size === 0) return [];
  const inTenant = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: [...ids] },
      ...(opts.includeInactive ? {} : { is_active: true })
    },
    select: { id: true }
  });
  return inTenant.map((u) => u.id);
}

/** Hisobotlar uchun (faqat faol agentlar). */
export async function loadAccessAgentScope(tenantId: number, userId: number): Promise<AccessAgentScope> {
  return loadAccessDataScope(tenantId, userId, { includeInactive: false });
}

export async function loadAccessDataScope(
  tenantId: number,
  userId: number,
  opts?: LoadAccessScopeOpts
): Promise<AccessAgentScope> {
  const includeInactive = opts?.includeInactive === true;
  const activeClause = includeInactive ? {} : { is_active: true };

  const [u, supervisees, territoryLinks, warehouseLinks, cashLinks] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { trade_direction_links: { select: { trade_direction_id: true } } }
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, supervisor_user_id: userId, ...activeClause },
      select: { id: true }
    }),
    prisma.territoryUserLink.findMany({
      where: { user_id: userId, territory: { tenant_id: tenantId, deleted_at: null } },
      select: { territory_id: true }
    }),
    prisma.warehouseUserLink.findMany({
      where: { user_id: userId },
      select: { warehouse_id: true }
    }),
    prisma.cashDeskUserLink.findMany({
      where: { user_id: userId },
      select: { cash_desk_id: true }
    })
  ]);

  const territory_ids = uniquePositiveIds(territoryLinks.map((l) => l.territory_id));
  const territoryStaffIds = await listStaffIdsLinkedToTerritories(tenantId, territory_ids, {
    includeInactive
  });
  const superviseeIds = uniquePositiveIds(supervisees.map((s) => s.id));
  const bound_staff_ids = resolveVisibleStaffIds(superviseeIds, territory_ids, territoryStaffIds);

  const bound_agent_ids =
    bound_staff_ids.length === 0
      ? []
      : (
          await prisma.user.findMany({
            where: {
              tenant_id: tenantId,
              id: { in: bound_staff_ids },
              role: "agent",
              ...activeClause
            },
            select: { id: true }
          })
        ).map((a) => a.id);

  return {
    bound_agent_ids,
    bound_staff_ids,
    territory_ids,
    warehouse_ids: uniquePositiveIds(warehouseLinks.map((l) => l.warehouse_id)),
    cash_desk_ids: uniquePositiveIds(cashLinks.map((l) => l.cash_desk_id)),
    trade_direction_ids: u?.trade_direction_links.map((x) => x.trade_direction_id) ?? []
  };
}

/**
 * Admin — to‘liq katalog. Qolgan rollar — Dostup biriktirishlari.
 * Agent — faqat o‘zi.
 */
export async function enrichScopedReportActor(
  tenantId: number,
  actor: { userId: number | null; role: string }
): Promise<ScopedReportActor> {
  if (!actor.userId) {
    return { ...actor, ...EMPTY_ACCESS_SCOPE };
  }
  if (actorHasUnrestrictedDataScope(actor.role)) {
    return { ...actor, ...EMPTY_ACCESS_SCOPE };
  }
  const scope = await loadAccessDataScope(tenantId, actor.userId, { includeInactive: false });
  if (actor.role === "agent") {
    return {
      ...actor,
      ...scope,
      bound_agent_ids: [actor.userId],
      bound_staff_ids: [actor.userId]
    };
  }
  return { ...actor, ...scope };
}

export async function buildScopedAgentWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput> {
  if (!actor) return buildScopedAgentWhere(tenantId);
  const enriched = await enrichScopedReportActor(tenantId, actor);
  return buildScopedAgentWhere(tenantId, enriched);
}

export async function buildScopedStaffDirectoryWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput | null> {
  if (!actor?.userId) return null;
  if (actorHasUnrestrictedDataScope(actor.role)) return null;
  if (actor.role === "agent") return { id: actor.userId };
  const scope = await loadAccessDataScope(tenantId, actor.userId, { includeInactive: true });
  return buildScopedStaffDirectoryWhere({ ...actor, ...scope });
}

export async function buildScopedAgentDirectoryWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput | null> {
  return buildScopedStaffDirectoryWhereForActor(tenantId, actor);
}

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
