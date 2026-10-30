import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveUserPermissionKeys } from "../access/rbac.service";
import { missingClientBulkPermissions } from "./client-bulk-permissions";

/** `false` — 403 yuborildi; admin yoki RBAC o'chiq bo'lsa tekshirilmaydi. */
export async function ensureClientBulkPermissions(
  request: FastifyRequest,
  reply: FastifyReply,
  patches: readonly Record<string, unknown>[]
): Promise<boolean> {
  if (env.RBAC_ENFORCE_PERMISSIONS !== "1") return true;
  const user = getAccessUser(request);
  if (user.role === "admin") return true;
  const userId = Number(user.sub);
  if (!Number.isInteger(userId) || userId < 1) return true;
  const keys = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
  const missing = missingClientBulkPermissions(patches, (k) => keys.has(k));
  if (missing.length === 0) return true;
  void sendApiError(reply, request, 403, "ForbiddenPermission", undefined, { permissions: missing });
  return false;
}
