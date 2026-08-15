import { prisma } from "../../config/database";
import { isOperatorLikeWebRole } from "../../lib/tenant-user-roles";

export type DirectoryScopeActor = {
  userId: number | null;
  role: string;
};

/**
 * Staff directory Access binds for operator-like roles.
 * Admin / other roles → `null` (full catalog).
 * Operator-like → linked ids; zero links → `[]` (empty list, safer than all).
 */
export async function resolveActorCashDeskDirectoryIds(
  _tenantId: number,
  actor?: DirectoryScopeActor
): Promise<number[] | null> {
  if (!actor?.userId || actor.role === "admin") return null;
  if (!isOperatorLikeWebRole(actor.role)) return null;
  const links = await prisma.cashDeskUserLink.findMany({
    where: { user_id: actor.userId },
    select: { cash_desk_id: true },
    orderBy: { cash_desk_id: "asc" }
  });
  return [...new Set(links.map((l) => l.cash_desk_id))];
}

export async function resolveActorWarehouseDirectoryIds(
  _tenantId: number,
  actor?: DirectoryScopeActor
): Promise<number[] | null> {
  if (!actor?.userId || actor.role === "admin") return null;
  if (!isOperatorLikeWebRole(actor.role)) return null;
  const links = await prisma.warehouseUserLink.findMany({
    where: { user_id: actor.userId },
    select: { warehouse_id: true },
    orderBy: { warehouse_id: "asc" }
  });
  return [...new Set(links.map((l) => l.warehouse_id))];
}

export async function resolveActorTradeDirectionDirectoryIds(
  tenantId: number,
  actor?: DirectoryScopeActor
): Promise<number[] | null> {
  if (!actor?.userId || actor.role === "admin") return null;
  if (!isOperatorLikeWebRole(actor.role)) return null;
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
