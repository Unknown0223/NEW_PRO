import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { tenantIdFrom } from "../../domain/tenant-id";
import { toFio } from "../staff/staff.shared.helpers";
import { isSessionEnforcedRole, MOBILE_FIELD_ROLES } from "./app-access.service";

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
};
type RefreshInput = { refreshToken: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildTokens(
  app: FastifyInstance,
  user: { id: number; tenant_id: number; role: string; login: string },
  tenantSlug: string,
  deviceId?: string | null
) {
  const accessToken = app.jwt.sign(
    {
      sub: String(user.id),
      tenantId: user.tenant_id,
      role: user.role,
      login: user.login,
      tenantSlug,
      ...(deviceId ? { did: deviceId } : {})
    },
    { expiresIn: "15m" }
  );
  const refreshToken = randomBytes(48).toString("hex");
  return { accessToken, refreshToken };
}

export async function login(app: FastifyInstance, input: LoginInput) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (!tenant || !tenant.is_active) {
    throw new Error("TENANT_NOT_FOUND");
  }
  const tenantId = tenantIdFrom(tenant.id);

  const user = await prisma.user.findUnique({
    where: { tenant_id_login: { tenant_id: tenantId, login: input.login } }
  });
  if (!user || !user.is_active) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await bcrypt.compare(input.password, user.password_hash);
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (MOBILE_FIELD_ROLES.has(user.role) && user.app_access === false) {
    throw new Error("APP_ACCESS_DENIED");
  }

  const deviceId = input.device_id?.trim().slice(0, 64) || null;
  const maxSessions = Math.max(1, user.max_sessions ?? 1);
  const sessionWhere = {
    user_id: user.id,
    tenant_id: tenantId,
    revoked_at: null,
    expires_at: { gt: new Date() } as const
  };

  /* Bitta qurilma — bitta sessiya: o'sha qurilmadan qayta kirilsa,
     uning eski sessiyasi almashtiriladi (o'z slotini band qilmaydi, hech qachon bloklanmaydi). */
  if (deviceId) {
    await prisma.refreshToken.updateMany({
      where: { ...sessionWhere, device_id: deviceId },
      data: { revoked_at: new Date() }
    });
  }

  /* Admin sessiya cheklovidan ozod (cheksiz qurilma). Qolganlar uchun: boshqa
     qurilmalardagi faol sessiyalar soni limitga yetgan bo'lsa — yangi qurilmadan
     kirishni BLOKLAYMIZ (foydalanuvchi boshqa qurilmadan chiqishi yoki admin
     sessiyani yopishi kerak). */
  if (isSessionEnforcedRole(user.role)) {
    const activeSessions = await prisma.refreshToken.count({ where: sessionWhere });
    if (activeSessions >= maxSessions) {
      throw new Error("SESSION_LIMIT");
    }
  }

  const tokens = buildTokens(app, user, tenant.slug, deviceId);
  const deviceName = input.device_name?.trim().slice(0, 255) || null;
  const userAgent = input.user_agent?.trim().slice(0, 512) || null;
  const ipAddr = input.ip_address?.trim().slice(0, 64) || null;

  await prisma.refreshToken.create({
    data: {
      tenant_id: tenantId,
      user_id: user.id,
      token_hash: hashToken(tokens.refreshToken),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      device_name: deviceName,
      device_id: deviceId,
      user_agent: userAgent,
      ip_address: ipAddr
    }
  });

  const apkVersion = input.apk_version?.trim().slice(0, 64) || null;
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
      tenantSlug: tenant.slug
    });
  }

  return {
    ...tokens,
    user: {
      id: user.id,
      name: toFio(user),
      login: user.login,
      role: user.role,
      tenantId: user.tenant_id,
      code: user.code,
      app_access: user.app_access
    },
    ...(app_update ? { app_update } : {})
  };
}

export async function refresh(app: FastifyInstance, input: RefreshInput) {
  const tokenHash = hashToken(input.refreshToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true, tenant: true }
  });

  if (!existing || existing.revoked_at || existing.expires_at < new Date()) {
    throw new Error("INVALID_REFRESH");
  }
  if (!existing.tenant.is_active || !existing.user.is_active) {
    throw new Error("INVALID_REFRESH");
  }

  if (MOBILE_FIELD_ROLES.has(existing.user.role) && existing.user.app_access === false) {
    throw new Error("APP_ACCESS_DENIED");
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revoked_at: new Date() }
  });

  const tokens = buildTokens(app, existing.user, existing.tenant.slug, existing.device_id);
  await prisma.refreshToken.create({
    data: {
      tenant_id: existing.tenant_id,
      user_id: existing.user_id,
      token_hash: hashToken(tokens.refreshToken),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      device_name: existing.device_name,
      device_id: existing.device_id,
      user_agent: existing.user_agent,
      ip_address: existing.ip_address
    }
  });

  return tokens;
}

export async function logout(input: RefreshInput) {
  const tokenHash = hashToken(input.refreshToken);
  await prisma.refreshToken.updateMany({
    where: { token_hash: tokenHash, revoked_at: null },
    data: { revoked_at: new Date() }
  });
}
