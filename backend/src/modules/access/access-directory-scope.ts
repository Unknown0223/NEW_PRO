import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "./access-agent-scope";
import { actorHasUnrestrictedDataScope, uniquePositiveIds } from "./access-staff-scope";

export type DirectoryScopeActor = {
  userId: number | null;
  role: string;
};

/**
 * Staff directory Access binds.
 * Admin → `null` (full catalog).
 * Boshqa rollar → Dostup + ish o‘rni ids; zero links → `[]` (empty list).
 */
export async function resolveActorCashDeskDirectoryIds(
  tenantId: number,
  actor?: DirectoryScopeActor
): Promise<number[] | null> {
  if (!actor?.userId || actorHasUnrestrictedDataScope(actor.role)) return null;
  const enriched = await enrichScopedReportActor(tenantId, actor);
  return uniquePositiveIds(enriched.cash_desk_ids ?? []);
}

export async function resolveActorWarehouseDirectoryIds(
  tenantId: number,
  actor?: DirectoryScopeActor
): Promise<number[] | null> {
  if (!actor?.userId || actorHasUnrestrictedDataScope(actor.role)) return null;
  const enriched = await enrichScopedReportActor(tenantId, actor);
  return uniquePositiveIds(enriched.warehouse_ids ?? []);
}

export async function resolveActorTradeDirectionDirectoryIds(
  tenantId: number,
  actor?: DirectoryScopeActor
): Promise<number[] | null> {
  if (!actor?.userId || actor.role === "admin") return null;
  const links = await prisma.userTradeDirectionLink.findMany({
    where: { tenant_id: tenantId, user_id: actor.userId },
    select: { trade_direction_id: true },
    orderBy: { trade_direction_id: "asc" }
  });
  return [...new Set(links.map((l) => l.trade_direction_id))];
}

/** Intersect actor directory scope with linkage constraint ids. `undefined` = no id filter. */
export function mergeDirectoryAllowedIds(
  actorIds: number[] | null,
  constraintIds: number[] | undefined
): number[] | undefined {
  if (actorIds === null && constraintIds === undefined) return undefined;
  if (actorIds === null) return constraintIds;
  if (constraintIds === undefined) return actorIds;
  const allowed = new Set(constraintIds);
  return actorIds.filter((id) => allowed.has(id));
}

/** Get-by-id: `null` actor scope = unrestricted. */
export function isDirectoryIdAllowed(actorIds: number[] | null, id: number): boolean {
  if (actorIds === null) return true;
  return actorIds.includes(id);
}
