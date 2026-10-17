import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import {
  MOBILE_FIELD_ROLE_NAMES,
  MOBILE_FIELD_ROLES,
  isMobileFieldRole,
  type MobileFieldRole
} from "../../lib/constants";
import {
  APP_ACCESS_DENIED_MESSAGE,
  APP_ACCESS_ENFORCED_ROLE_NAMES,
  APP_ACCESS_ENFORCED_ROLES,
  assertAppAccessAllowed,
  isAppAccessEnforcedRole
} from "./app-access.constants";
import { getAccessUser } from "./auth.prehandlers";

export { MOBILE_FIELD_ROLE_NAMES, MOBILE_FIELD_ROLES, isMobileFieldRole, type MobileFieldRole };
export {
  APP_ACCESS_DENIED_MESSAGE,
  APP_ACCESS_ENFORCED_ROLE_NAMES,
  APP_ACCESS_ENFORCED_ROLES,
  assertAppAccessAllowed,
  isAppAccessEnforcedRole
};

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

/** Alias: DB dagi app_access + is_active (JWT kill-switch uchun). */
export const isAppAccessAllowed = isMobileAppAccessAllowed;

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
 * Chiqish faqat: hodim o‘zi chiqdi yoki admin webdan sessiyani yopdi
 * (faol refresh token qolmagan). Qurilma id mos kelmasa ham token qolgan
 * bo‘lsa — ishlayotgan hodimni chiqarmaymiz.
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
  if (n > 0) return true;
  return hasActiveRefreshSession(tenantId, userId);
}

const REFRESH_SLIDE_MS = 30 * 24 * 60 * 60 * 1000;

/** Ilova ochiq ekan — muddat uzayadi (o‘zi chiqmaguncha / admin yopmaguncha). */
export async function touchActiveRefreshSessions(
  tenantId: number,
  userId: number,
  deviceId?: string | null
): Promise<void> {
  if (!Number.isFinite(userId) || userId < 1 || !Number.isFinite(tenantId)) return;
  const nextExpiry = new Date(Date.now() + REFRESH_SLIDE_MS);
  const base = {
    tenant_id: tenantId,
    user_id: userId,
    revoked_at: null,
    expires_at: { gt: new Date() }
  };
  const did = deviceId?.trim() || null;
  if (did) {
    const r = await prisma.refreshToken.updateMany({
      where: { ...base, device_id: did },
      data: { expires_at: nextExpiry }
    });
    if (r.count > 0) return;
  }
  await prisma.refreshToken.updateMany({
    where: base,
    data: { expires_at: nextExpiry }
  });
}

/** Mobil JWT hali amal qilsa ham server sessiyasi yopilgan bo‘lsa — 401.
 * Faqat faol refresh token umuman yo‘q bo‘lganda (admin yoki o‘zi chiqdi).
 */
export async function requireActiveMobileSession(request: FastifyRequest, reply: FastifyReply) {
  const user = getAccessUser(request);
  if (!MOBILE_FIELD_ROLES.has(user.role)) return;

  const userId = Number(user.sub);
  if (!Number.isFinite(userId) || userId < 1) {
    return sendApiError(reply, request, 401, "InvalidAccessUser");
  }

  const active = await hasActiveSessionForDevice(user.tenantId, userId, user.did);
  if (!active) {
    return sendApiError(reply, request, 401, "SESSION_REVOKED", "Сессия завершена");
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
    return sendApiError(reply, request, 401, "SESSION_REVOKED", "Сессия завершена");
  }
}

/**
 * JWT dan keyin: `APP_ACCESS_ENFORCED_ROLES` uchun DB `app_access` tekshiruvi.
 * Access token hali amal qilsa ham, admin «Доступ к приложению» ni o‘chirganda 403.
 */
export async function requireAppAccessForEnforcedRoles(request: FastifyRequest, reply: FastifyReply) {
  const user = getAccessUser(request);
  if (!isAppAccessEnforcedRole(user.role)) return;

  const userId = Number(user.sub);
  if (!Number.isFinite(userId) || userId < 1) {
    return sendApiError(reply, request, 401, "InvalidAccessUser");
  }

  const allowed = await isAppAccessAllowed(userId);
  if (!allowed) {
    return sendApiError(reply, request, 403, "APP_ACCESS_DENIED", APP_ACCESS_DENIED_MESSAGE);
  }
}

/** @deprecated Use requireAppAccessForEnforcedRoles — mobile field roles subset covered. */
export async function requireMobileAppAccess(request: FastifyRequest, reply: FastifyReply) {
  return requireAppAccessForEnforcedRoles(request, reply);
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
