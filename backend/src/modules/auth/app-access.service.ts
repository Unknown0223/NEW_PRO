import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import {
  MOBILE_FIELD_ROLE_NAMES,
  MOBILE_FIELD_ROLES,
  isMobileFieldRole,
  type MobileFieldRole
} from "../../lib/constants";
import { getAccessUser } from "./auth.prehandlers";

export { MOBILE_FIELD_ROLE_NAMES, MOBILE_FIELD_ROLES, isMobileFieldRole, type MobileFieldRole };

/**
 * Ajratilgan sessiya cheklovi qo'llanmaydigan rollar.
 * Admin har doim ishlaydi (cheklovsiz), qolgan barcha rollar — bitta
 * qurilma/sessiya nazoratiga tushadi.
 */
export const SESSION_ENFORCEMENT_EXEMPT_ROLES = new Set(["admin"]);

export function isSessionEnforcedRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return !SESSION_ENFORCEMENT_EXEMPT_ROLES.has(role);
}

/** Mobil ilova sessiyalarini yopish (web «Доступ к приложению» = выкл). */
export async function revokeAllRefreshTokensForUser(tenantId: number, userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tenant_id: tenantId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() }
  });
}

export async function isMobileAppAccessAllowed(userId: number): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1) return false;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { app_access: true, is_active: true }
  });
  return Boolean(row?.is_active && row.app_access !== false);
}

/** Faol refresh token (web «Завершить все сессии» dan keyin yo‘q). */
export async function hasActiveRefreshSession(tenantId: number, userId: number): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1 || !Number.isFinite(tenantId)) return false;
  const n = await prisma.refreshToken.count({
    where: {
      user_id: userId,
      tenant_id: tenantId,
      revoked_at: null,
      expires_at: { gt: new Date() }
    }
  });
  return n > 0;
}

/**
 * Aniq qurilma sessiyasi tirikligini tekshirish.
 * `deviceId` bo'lsa — faqat o'sha qurilma sessiyasi (boshqa qurilmada kirilganda
 * shu qurilma chiqarib yuborilgani aniqlanadi). Aks holda — istalgan faol sessiya
 * (eski access tokenlar bilan orqaga moslik).
 */
export async function hasActiveSessionForDevice(
  tenantId: number,
  userId: number,
  deviceId: string | null | undefined
): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1 || !Number.isFinite(tenantId)) return false;
  if (!deviceId) return hasActiveRefreshSession(tenantId, userId);
  const n = await prisma.refreshToken.count({
    where: {
      user_id: userId,
      tenant_id: tenantId,
      device_id: deviceId,
      revoked_at: null,
      expires_at: { gt: new Date() }
    }
  });
  return n > 0;
}

/** Mobil JWT hali amal qilsa ham server sessiyasi yopilgan bo‘lsa — 401. */
export async function requireActiveMobileSession(request: FastifyRequest, reply: FastifyReply) {
  const user = getAccessUser(request);
  if (!MOBILE_FIELD_ROLES.has(user.role)) return;

  const userId = Number(user.sub);
  if (!Number.isFinite(userId) || userId < 1) {
    return sendApiError(reply, request, 401, "InvalidAccessUser");
  }

  const active = await hasActiveSessionForDevice(user.tenantId, userId, user.did);
  if (!active) {
    return sendApiError(reply, request, 401, "SESSION_REVOKED", "Sessiya tugatildi");
  }
}

/**
 * JWT amal qilsa ham, admindan tashqari foydalanuvchining server sessiyasi
 * yopilgan bo'lsa (boshqa qurilmada kirildi yoki admin tugatdi) — 401.
 * Web + mobil uchun umumiy. Adminlar bu tekshiruvdan ozod.
 */
export async function requireActiveSessionForNonAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = getAccessUser(request);
  if (!isSessionEnforcedRole(user.role)) return;

  const userId = Number(user.sub);
  if (!Number.isFinite(userId) || userId < 1) {
    return sendApiError(reply, request, 401, "InvalidAccessUser");
  }

  const active = await hasActiveSessionForDevice(user.tenantId, userId, user.did);
  if (!active) {
    return sendApiError(reply, request, 401, "SESSION_REVOKED", "Sessiya tugatildi");
  }
}

/** JWT dan keyin: agent/expeditor/supervisor uchun app_access tekshiruvi. */
export async function requireMobileAppAccess(request: FastifyRequest, reply: FastifyReply) {
  const user = getAccessUser(request);
  if (!MOBILE_FIELD_ROLES.has(user.role)) return;

  const userId = Number(user.sub);
  if (!Number.isFinite(userId) || userId < 1) {
    return sendApiError(reply, request, 401, "InvalidAccessUser");
  }

  const allowed = await isMobileAppAccessAllowed(userId);
  if (!allowed) {
    return sendApiError(reply, request, 403, "APP_ACCESS_DENIED", "Ilova kirish o‘chirilgan");
  }
}

/** PATCH app_access=false bo‘lganda barcha refresh tokenlarni bekor qilish. */
export async function onAppAccessChanged(
  tenantId: number,
  userId: number,
  appAccess: boolean | undefined
): Promise<void> {
  if (appAccess === false) {
    await revokeAllRefreshTokensForUser(tenantId, userId);
  }
}

/** Bulk: bir nechta foydalanuvchi uchun app_access o‘chirilganda sessiyalar yopiladi. */
export async function onBulkAppAccessChanged(
  tenantId: number,
  userIds: number[],
  appAccess: boolean
): Promise<void> {
  if (!appAccess && userIds.length > 0) {
    const now = new Date();
    await prisma.refreshToken.updateMany({
      where: { tenant_id: tenantId, user_id: { in: userIds }, revoked_at: null },
      data: { revoked_at: now }
    });
  }
}
