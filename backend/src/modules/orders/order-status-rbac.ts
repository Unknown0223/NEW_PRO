import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveUserPermissionKeys } from "../access/rbac.service";
import {
  ORDER_STATUS_DATE_PERMISSION,
  buildOrderStatusPermissionChecker,
  type OrderStatusPermissionChecker
} from "./order-status-permissions";

export type OrderStatusRbac = { canTransition: OrderStatusPermissionChecker; canEditStatusDate: boolean };

/** Veb so'rov uchun status ruxsatlari; admin yoki RBAC o'chiq bo'lsa — null (cheklov yo'q). */
export async function resolveOrderStatusRbac(request: FastifyRequest): Promise<OrderStatusRbac | null> {
  if (env.RBAC_ENFORCE_PERMISSIONS !== "1") return null;
  const user = getAccessUser(request);
  if (user.role === "admin") return null;
  const userId = Number(user.sub);
  if (!Number.isInteger(userId) || userId < 1) return null;
  const keys = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
  return {
    canTransition: buildOrderStatusPermissionChecker(keys),
    canEditStatusDate: keys.has(ORDER_STATUS_DATE_PERMISSION)
  };
}

export function sendOrderStatusPermissionError(reply: FastifyReply, request: FastifyRequest, e: unknown) {
  const ex = e as Error & { from?: string; to?: string; permission?: string | null };
  return sendApiError(reply, request, 403, "ForbiddenPermission", undefined, {
    from: ex.from,
    to: ex.to,
    permissions: ex.permission ? [ex.permission] : []
  });
}
