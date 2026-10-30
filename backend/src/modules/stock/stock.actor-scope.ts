import type { FastifyRequest } from "fastify";
import { actorUserIdOrNull } from "../../lib/request-actor";
import {
  isDirectoryIdAllowed,
  resolveActorWarehouseDirectoryIds
} from "../access/access-directory-scope";
import { getAccessUser } from "../auth/auth.prehandlers";

/**
 * Stock o‘qish API uchun actor ombor scope.
 * `null` — cheklov yo‘q (admin).
 * `number[]` — faqat bog‘langan omborlar (bo‘sh massiv = hech narsa).
 */
export async function resolveStockActorWarehouseIds(
  request: FastifyRequest,
  tenantId: number
): Promise<number[] | null> {
  const viewer = getAccessUser(request);
  return resolveActorWarehouseDirectoryIds(tenantId, {
    userId: actorUserIdOrNull(request),
    role: viewer.role ?? ""
  });
}

/** So‘ralgan warehouse_id actor scope ichida ekanini tekshiradi. */
export function isStockWarehouseAllowed(
  allowedIds: number[] | null,
  warehouseId: number | null | undefined
): boolean {
  if (warehouseId == null || !Number.isFinite(warehouseId)) return true;
  return isDirectoryIdAllowed(allowedIds, warehouseId);
}
