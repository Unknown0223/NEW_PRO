import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { tenantIdFrom } from "../../domain/tenant-id";
import { resolveTenantSlugAlias } from "../../lib/tenant-slug-alias";
import { MOBILE_FIELD_ROLES } from "./app-access.service";
import { decideRefreshReuse } from "./refresh-reuse.pure";
import {
  assertNotLocked,
  clearFailedLogin,
  recordFailedLogin,
  verifyLoginPassword
} from "./login-credentials";
import { issueLoginSession } from "./auth.login-session";
import { refreshExpiresAt } from "./session-ttl";

export { otherActiveSessionsWhere } from "./auth.session-where";
export { issueLoginSession, loginAfterFaceApproved } from "./auth.login-session";
export type { IssueSessionInput } from "./auth.login-session";

type LoginInput = {
  slug: string;
  login: string;
  password: string;
  device_name?: string | null;
  device_id?: string | null;
  user_agent?: string | null;
  apk_version?: string | null;
  ip_address?: string | null;
  request_origin?: string | null;
  /** Brauzer Origin / Forwarded — Face bridge URL uchun (Host API port bo‘lishi mumkin). */
  request_headers?: {
    origin?: string | string[];
    "x-forwarded-proto"?: string | string[];
    "x-forwarded-host"?: string | string[];
    host?: string | string[];
  };
};
type RefreshInput = { refreshToken: string };

/** Access JWT — qisqa muddat; refresh orqali yangilanadi (audit P1-2). */
const ACCESS_TOKEN_TTL = "15m";
/**
 * Parallel refresh (bir nechta 401 bir vaqtda) — eski token rotate qilinganidan
 * keyin qisqa oynada qayta ishlatilsa yangi juftlik beriladi.
 * Undan keyin reuse = oila o‘g‘irligi → butun family revoke.
 */
const REFRESH_REUSE_GRACE_MS = 30_000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildAccessToken(
  app: FastifyInstance,
  user: { id: number; tenant_id: number; role: string; login: string },
  tenantSlug: string,
  opts: { deviceId?: string | null; sessionId: number }
) {
  return app.jwt.sign(
    {
      sub: String(user.id),
      tenantId: user.tenant_id,
      role: user.role,
      login: user.login,
      tenantSlug,
      sid: opts.sessionId,
      ...(opts.deviceId ? { did: opts.deviceId } : {})
    },
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function newRefreshTokenValue(): string {
  return randomBytes(48).toString("hex");
}

async function revokeRefreshFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { family_id: familyId, revoked_at: null },
    data: { revoked_at: new Date() }
  });
}

export async function login(app: FastifyInstance, input: LoginInput) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: resolveTenantSlugAlias(input.slug) } });
  if (!tenant || !tenant.is_active) {
    throw new Error("TENANT_NOT_FOUND");
  }
  const tenantId = tenantIdFrom(tenant.id);

  const user = await prisma.user.findUnique({
    where: { tenant_id_login: { tenant_id: tenantId, login: input.login } }
  });

  await assertNotLocked(user);
  const ok = await verifyLoginPassword(user, input.password);
  if (!user || !user.is_active || !ok) {
    if (user?.is_active) await recordFailedLogin(user);
    throw new Error("INVALID_CREDENTIALS");
  }

  await clearFailedLogin(user.id);

  if (MOBILE_FIELD_ROLES.has(user.role) && user.app_access === false) {
    throw new Error("APP_ACCESS_DENIED");
  }

  {
    const { assertWebPanelLoginAllowed } = await import("./web-panel-access");
    assertWebPanelLoginAllowed(user.role, { apk_version: input.apk_version });
  }

  /* Admin mustasno: WorkSlot rollari tenantda slotlar bo‘lsa — faol ishchi o‘rni shart. */
  {
    const { assertUserOnWorkSlot } = await import("../work-slots/work-slots.access-gate");
    await assertUserOnWorkSlot(tenantId, user.id, user.role);
  }

  /* Face ID (faqat veb): challenge approved bo‘lguncha token bermaymiz.
     Mobil APK (apk_version bor) o‘z FaceGate (daily_login) dan foydalanadi — bu yerda o‘tkazib yuboriladi. */
  const isMobileClient = Boolean(input.apk_version?.trim());
  if (!isMobileClient) {
    const { userNeedsFaceLogin, createFaceLoginChallenge } = await import("./face-login.service");
    if (await userNeedsFaceLogin(tenantId, user.id)) {
      const apkVersion = input.apk_version?.trim().slice(0, 64) || null;
      return createFaceLoginChallenge({
        tenantId,
        tenantSlug: tenant.slug,
        user,
        meta: {
          device_id: input.device_id?.trim().slice(0, 64) || null,
          device_name: input.device_name?.trim().slice(0, 255) || null,
          user_agent: input.user_agent?.trim().slice(0, 512) || null,
          apk_version: apkVersion,
          ip_address: input.ip_address?.trim().slice(0, 64) || null,
          request_origin: input.request_origin ?? null
        },
        publicOrigin: input.request_origin,
        headers: input.request_headers
      });
    }
  }

  return issueLoginSession(app, {
    tenantId,
    tenantSlug: tenant.slug,
    user,
    device_id: input.device_id,
    device_name: input.device_name,
    user_agent: input.user_agent,
    apk_version: input.apk_version,
    ip_address: input.ip_address,
    request_origin: input.request_origin
  });
}

export async function refresh(app: FastifyInstance, input: RefreshInput) {
  const tokenHash = hashToken(input.refreshToken);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true, tenant: true }
    });

    if (!existing) {
      throw new Error("INVALID_REFRESH");
    }

    const decision = decideRefreshReuse({
      nowMs: Date.now(),
      expiresAtMs: existing.expires_at.getTime(),
      revokedAtMs: existing.revoked_at ? existing.revoked_at.getTime() : null,
      graceMs: REFRESH_REUSE_GRACE_MS
    });

    if (decision.action === "reject_expired") {
      throw new Error("INVALID_REFRESH");
    }

    if (decision.action === "reject_reuse_theft") {
      await tx.refreshToken.updateMany({
        where: { family_id: existing.family_id, revoked_at: null },
        data: { revoked_at: new Date() }
      });
      throw new Error("REFRESH_REUSE_DETECTED");
    }

    if (!existing.tenant.is_active || !existing.user.is_active) {
      throw new Error("INVALID_REFRESH");
    }

    if (MOBILE_FIELD_ROLES.has(existing.user.role) && existing.user.app_access === false) {
      throw new Error("APP_ACCESS_DENIED");
    }

    {
      const { assertUserOnWorkSlot } = await import("../work-slots/work-slots.access-gate");
      await assertUserOnWorkSlot(existing.tenant_id, existing.user.id, existing.user.role);
    }

    /* Absolute max: oila birinchi tokenidan 1 soat — slide bilan uzaytirilmaydi. */
    const familyFirst = await tx.refreshToken.findFirst({
      where: { family_id: existing.family_id },
      orderBy: { created_at: "asc" },
      select: { created_at: true }
    });
    const familyStartedMs = familyFirst?.created_at.getTime() ?? existing.created_at.getTime();
    const absoluteExpiresAt = refreshExpiresAt(familyStartedMs);
    if (Date.now() >= absoluteExpiresAt.getTime()) {
      throw new Error("INVALID_REFRESH");
    }

    const refreshToken = newRefreshTokenValue();
    const session = await tx.refreshToken.create({
      data: {
        tenant_id: existing.tenant_id,
        user_id: existing.user_id,
        token_hash: hashToken(refreshToken),
        family_id: existing.family_id,
        expires_at: absoluteExpiresAt,
        device_name: existing.device_name,
        device_id: existing.device_id,
        user_agent: existing.user_agent,
        ip_address: existing.ip_address
      },
      select: { id: true }
    });
    const accessToken = buildAccessToken(app, existing.user, existing.tenant.slug, {
      deviceId: existing.device_id,
      sessionId: session.id
    });
    /* Avval yangi token — ping /auth/me 0 sessiya ko‘rib SESSION_REVOKED qilmasin. */
    if (!existing.revoked_at) {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revoked_at: new Date() }
      });
    }

    return { accessToken, refreshToken };
  });
}

export async function logout(input: RefreshInput) {
  const tokenHash = hashToken(input.refreshToken);
  const row = await prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
    select: { family_id: true }
  });
  if (!row) return;
  await revokeRefreshFamily(row.family_id);
}

/** Web/mobil: o‘z parolini almashtirish + must_change_password ni yechish. */
export async function changeOwnPassword(
  tenantId: number,
  userId: number,
  input: { old_password: string; new_password: string }
) {
  const { changeMobileMePassword } = await import("../mobile/mobile-profile.service");
  return changeMobileMePassword(tenantId, userId, input);
}
