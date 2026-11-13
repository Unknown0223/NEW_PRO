import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { isSessionLimitReached, isUnlimitedMaxSessions } from "../../lib/max-sessions";
import { isSessionEnforcedRole, MOBILE_FIELD_ROLES } from "./app-access.service";
import { otherActiveSessionsWhere } from "./auth.session-where";
import { refreshExpiresAt } from "./session-ttl";

const ACCESS_TOKEN_TTL = "15m";

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

export type IssueSessionInput = {
  tenantId: number;
  tenantSlug: string;
  user: {
    id: number;
    tenant_id: number;
    login: string;
    role: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    code?: string | null;
    app_access: boolean;
    must_change_password: boolean;
    max_sessions?: number | null;
    device_name?: string | null;
    apk_version?: string | null;
  };
  device_id?: string | null;
  device_name?: string | null;
  user_agent?: string | null;
  apk_version?: string | null;
  ip_address?: string | null;
  request_origin?: string | null;
};

/** Parol yoki Face ID tasdiqdan keyin — bir xil sessiya ochish. */
export async function issueLoginSession(app: FastifyInstance, input: IssueSessionInput) {
  const tenantId = input.tenantId;
  const user = input.user;
  const deviceId = input.device_id?.trim().slice(0, 64) || null;
  const now = new Date();
  const sessionWhere = {
    user_id: user.id,
    tenant_id: tenantId,
    revoked_at: null,
    expires_at: { gt: now } as const
  };

  if (isSessionEnforcedRole(user.role) && !isUnlimitedMaxSessions(user.max_sessions ?? 1)) {
    const activeSessions = await prisma.refreshToken.count({
      where: otherActiveSessionsWhere({
        userId: user.id,
        tenantId,
        deviceId,
        now
      })
    });
    if (isSessionLimitReached(activeSessions, user.max_sessions ?? 1)) {
      throw new Error("SESSION_LIMIT");
    }
  }

  const deviceName = input.device_name?.trim().slice(0, 255) || null;
  const userAgent = input.user_agent?.trim().slice(0, 512) || null;
  const ipAddr = input.ip_address?.trim().slice(0, 64) || null;
  const refreshToken = newRefreshTokenValue();
  const newHash = hashToken(refreshToken);
  const familyId = randomUUID();

  const session = await prisma.refreshToken.create({
    data: {
      tenant_id: tenantId,
      user_id: user.id,
      token_hash: newHash,
      family_id: familyId,
      expires_at: refreshExpiresAt(),
      device_name: deviceName,
      device_id: deviceId,
      user_agent: userAgent,
      ip_address: ipAddr
    },
    select: { id: true }
  });

  const accessToken = buildAccessToken(app, user, input.tenantSlug, {
    deviceId,
    sessionId: session.id
  });
  const tokens = { accessToken, refreshToken };

  if (deviceId) {
    await prisma.refreshToken.updateMany({
      where: {
        ...sessionWhere,
        device_id: deviceId,
        token_hash: { not: newHash }
      },
      data: { revoked_at: new Date() }
    });
  }

  const apkVersion = input.apk_version?.trim().slice(0, 64) || null;
  void import("../security/login-alerts.detect")
    .then(async ({ recordLoginAndDetect }) => {
      const { platformOfLogin } = await import("../security/login-alerts.pure");
      await recordLoginAndDetect({
        tenantId,
        userId: user.id,
        platform: platformOfLogin(apkVersion),
        deviceId,
        deviceName,
        ip: ipAddr,
        userAgent
      });
    })
    .catch(() => undefined);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(deviceName ? { device_name: deviceName } : {}),
      ...(apkVersion ? { apk_version: apkVersion } : {})
    }
  });

  let app_update: Awaited<
    ReturnType<typeof import("../mobile/app-release.service").resolveAppUpdateForTenant>
  > | null = null;
  if (MOBILE_FIELD_ROLES.has(user.role)) {
    const { resolveAppUpdateForTenant } = await import("../mobile/app-release.service");
    app_update = await resolveAppUpdateForTenant(tenantId, apkVersion, "android", {
      origin: input.request_origin,
      tenantSlug: input.tenantSlug,
      role: user.role
    });
  }

  return {
    ...tokens,
    user: {
      id: user.id,
      name: toFio({
        name: user.name,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        middle_name: user.middle_name ?? null
      }),
      login: user.login,
      role: user.role,
      tenantId: user.tenant_id,
      code: user.code,
      app_access: user.app_access,
      must_change_password: user.must_change_password === true
    },
    ...(app_update ? { app_update } : {})
  };
}

export async function loginAfterFaceApproved(app: FastifyInstance, input: IssueSessionInput) {
  return issueLoginSession(app, input);
}
