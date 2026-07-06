import type { FastifyReply, FastifyRequest } from "fastify";
import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import { sendApiError } from "../../lib/api-error";
import { resolveUserPermissionKeys } from "../access/rbac.service";

export type AccessJwtUser = {
  sub: string;
  tenantId: number;
  role: string;
  login: string;
  /** Issued since 2026-04 — URL tenant slug source of truth for `/api/:slug/...` */
  tenantSlug?: string;
  /** Qurilma identifikatori (2026-06+). Aniq qurilma sessiyasi tirikligini tekshirish uchun. */
  did?: string;
};

export function getAccessUser(request: FastifyRequest): AccessJwtUser {
  return request.user as AccessJwtUser;
}

export async function jwtAccessVerify(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify<AccessJwtUser>();
  } catch {
    /** @fastify/jwt ba’zi holatlarda `statusCode`siz tashlaydi — client 500 ko‘radi; doim 401. */
    return sendApiError(reply, request, 401, "Unauthorized", "Invalid or expired access token");
  }
}

/**
 * Foydalanuvchi / agent / ekspeditor / supervizor ro‘yxatlarini o‘qish (filtrlar, mijoz tahriri).
 * POST va tahrirlar odatda `admin` / `operator` da qoladi.
 */
export const DIRECTORY_READ_ROLES = [
  "admin",
  ...OPERATOR_LIKE_WEB_ROLES,
  "supervisor",
  "agent",
  "expeditor"
] as const;

/** JWT allaqachon `jwtAccessVerify` orqali tekshirilgan bo‘lishi kerak. */
export function requireRoles(...allowed: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const role = getAccessUser(request).role;
    if (!role || !allowed.includes(role)) {
      return sendApiError(reply, request, 403, "ForbiddenRole");
    }
  };
}

export function requirePermission(permissionKey: string, opts?: { allowAdminRole?: boolean }) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAccessUser(request);
    if (opts?.allowAdminRole !== false && user.role === "admin") return;
    const userId = Number(user.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return sendApiError(reply, request, 401, "InvalidAccessUser");
    }
    const permissionKeys = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
    if (!permissionKeys.has(permissionKey)) {
      return sendApiError(reply, request, 403, "ForbiddenPermission", undefined, { permission: permissionKey });
    }
  };
}

export function requireAnyPermission(permissionKeys: string[], opts?: { allowAdminRole?: boolean }) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAccessUser(request);
    if (opts?.allowAdminRole !== false && user.role === "admin") return;
    const userId = Number(user.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return sendApiError(reply, request, 401, "InvalidAccessUser");
    }
    const effective = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
    if (!permissionKeys.some((k) => effective.has(k))) {
      return sendApiError(reply, request, 403, "ForbiddenPermission", undefined, { permissions: permissionKeys });
    }
  };
}
