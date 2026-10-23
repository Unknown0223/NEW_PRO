import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveUserPermissionKeys } from "./rbac.service";

/**
 * Route guard so'rov tanasini ko'rmaydi — tanaga bog'liq aniq kalit handler ichida tekshiriladi.
 * `false` — 403 yuborildi; admin yoki RBAC o'chiq bo'lsa tekshirilmaydi.
 */
export async function ensureAnyPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  anyOf: readonly string[]
): Promise<boolean> {
  if (env.RBAC_ENFORCE_PERMISSIONS !== "1") return true;
  const user = getAccessUser(request);
  if (user.role === "admin") return true;
  const userId = Number(user.sub);
  if (!Number.isInteger(userId) || userId < 1) return true;
  const keys = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
  if (anyOf.some((k) => keys.has(k))) return true;
  void sendApiError(reply, request, 403, "ForbiddenPermission", undefined, { permissions: [...anyOf] });
  return false;
}
