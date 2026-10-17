import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { resolveUserPermissionKeys } from "../access/rbac.resolve";
import { otherActiveSessionsWhere } from "../auth/auth.service";
import { createNotification } from "../notifications/notifications.service";
import { toFio } from "../staff/staff.shared.helpers";
import {
  LOGIN_ALERT_KIND_RU,
  SHARED_DEVICE_WINDOW_DAYS,
  SHARED_IP_WINDOW_MINUTES,
  decideAlertUpdate,
  ipMatchesWhitelist,
  isPrivateIp,
  mergeUserIds,
  normalizeIp,
  pushAlertEvent,
  tashkentDay,
  type LoginAlertKind,
  type LoginAlertRisk,
  type LoginPlatform
} from "./login-alerts.pure";

export const LOGIN_ALERTS_VIEW = "audit.podozritelnye_vhody.view";

export type LoginEventInput = {
  tenantId: number;
  userId: number;
  platform: LoginPlatform;
  deviceId: string | null;
  deviceName: string | null;
  ip: string | null;
  userAgent: string | null;
};

type Finding = {
  kind: LoginAlertKind;
  risk: LoginAlertRisk;
  key: string;
  userIds: number[];
  match: Record<string, string | number>;
};

export type AlertEventSnapshot = {
  user_id: number;
  at: string;
  platform: LoginPlatform;
  ip: string | null;
  device_id: string | null;
  device_name: string | null;
};

async function otherUsers(where: Prisma.AuthLoginEventWhereInput): Promise<number[]> {
  const rows = await prisma.authLoginEvent.findMany({
    where,
    select: { user_id: true },
    distinct: ["user_id"],
    take: 20
  });
  return rows.map((r) => r.user_id);
}

async function detect(ev: LoginEventInput, eventId: number, at: Date): Promise<Finding[]> {
  const { tenantId: tenant_id, userId, deviceId } = ev;
  const out: Finding[] = [];

  if (deviceId) {
    const since = new Date(at.getTime() - SHARED_DEVICE_WINDOW_DAYS * 86_400_000);
    const others = await otherUsers({ tenant_id, device_id: deviceId, user_id: { not: userId }, created_at: { gte: since } });
    if (others.length) {
      out.push({
        kind: "shared_device",
        risk: ev.platform === "mobile" ? "high" : "medium",
        key: `device:${deviceId}`,
        userIds: mergeUserIds([userId], others),
        match: { device_id: deviceId }
      });
    }

    const [hasHistory, seenDevice] = await Promise.all([
      prisma.authLoginEvent.findFirst({ where: { tenant_id, user_id: userId, id: { not: eventId } }, select: { id: true } }),
      prisma.authLoginEvent.findFirst({
        where: { tenant_id, user_id: userId, device_id: deviceId, id: { not: eventId } },
        select: { id: true }
      })
    ]);
    if (hasHistory && !seenDevice) {
      out.push({
        kind: "new_device",
        risk: "medium",
        key: `user:${userId}:device:${deviceId}`,
        userIds: [userId],
        match: { user_id: userId, device_id: deviceId }
      });
    }

    if (ev.platform === "mobile") {
      const active = await prisma.refreshToken.findMany({
        where: otherActiveSessionsWhere({ userId, tenantId: tenant_id, deviceId, now: at }),
        select: { device_id: true },
        take: 10
      });
      const otherDevices = [...new Set(active.map((a) => a.device_id).filter((d): d is string => !!d))];
      const otherPhone =
        otherDevices.length > 0 &&
        (await prisma.authLoginEvent.findFirst({
          where: { tenant_id, user_id: userId, platform: "mobile", device_id: { in: otherDevices } },
          select: { id: true }
        }));
      if (otherPhone) {
        out.push({
          kind: "concurrent_devices",
          risk: "high",
          key: `user:${userId}:concurrent`,
          userIds: [userId],
          match: { user_id: userId }
        });
      }
    }
  }

  const ip = normalizeIp(ev.ip);
  if (ip && !isPrivateIp(ip)) {
    const wl = await prisma.securityIpWhitelist.findMany({ where: { tenant_id }, select: { cidr: true } });
    if (!ipMatchesWhitelist(ip, wl.map((w) => w.cidr))) {
      const since = new Date(at.getTime() - SHARED_IP_WINDOW_MINUTES * 60_000);
      const others = await otherUsers({ tenant_id, ip_address: ip, user_id: { not: userId }, created_at: { gte: since } });
      if (others.length) {
        const day = tashkentDay(at);
        out.push({
          kind: "shared_ip",
          risk: "low",
          key: `ip:${ip}:${day}`,
          userIds: mergeUserIds([userId], others),
          match: { ip, day }
        });
      }
    }
  }
  return out;
}

async function alertRecipients(tenantId: number): Promise<number[]> {
  const candidates = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      OR: [
        { role: "admin" },
        { user_roles: { some: { role: { permissions: { some: { permission: { key: LOGIN_ALERTS_VIEW } } } } } } },
        { user_permissions: { some: { effect: "allow", permission: { key: LOGIN_ALERTS_VIEW } } } }
      ]
    },
    select: { id: true, role: true },
    take: 50
  });
  const out: number[] = [];
  for (const u of candidates) {
    if (u.role === "admin" || (await resolveUserPermissionKeys(tenantId, u.id, u.role)).has(LOGIN_ALERTS_VIEW)) {
      out.push(u.id);
    }
  }
  return out;
}

async function notifyHighRisk(tenantId: number, alertId: number, f: Finding, snap: AlertEventSnapshot) {
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: f.userIds } },
    select: { id: true, login: true, name: true, first_name: true, last_name: true, middle_name: true }
  });
  const who = users.map((u) => `${toFio(u)} (${u.login})`).join(", ");
  const where = snap.device_name ? ` · ${snap.device_name}` : "";
  const body = `${LOGIN_ALERT_KIND_RU[f.kind]}${where}: ${who}`;
  for (const uid of await alertRecipients(tenantId)) {
    await createNotification({
      tenant_id: tenantId,
      user_id: uid,
      title: "Подозрительный вход",
      body,
      link_href: `/suspicious-logins?id=${alertId}`
    }).catch(() => undefined);
  }
}

async function applyFinding(tenantId: number, f: Finding, snap: AlertEventSnapshot, at: Date) {
  const existing = await prisma.securityLoginAlert.findFirst({
    where: { tenant_id: tenantId, kind: f.kind, alert_key: f.key },
    orderBy: { id: "desc" }
  });
  const decision = decideAlertUpdate(existing, f.userIds);

  if (!existing || decision === "create") {
    const row = await prisma.securityLoginAlert.create({
      data: {
        tenant_id: tenantId,
        kind: f.kind,
        risk: f.risk,
        alert_key: f.key,
        user_ids: f.userIds,
        details: { match: f.match, events: [snap] } as Prisma.InputJsonValue,
        first_seen_at: at,
        last_seen_at: at
      }
    });
    if (f.risk === "high") await notifyHighRisk(tenantId, row.id, f, snap);
    return;
  }

  const prev = (existing.details ?? {}) as { match?: unknown; events?: AlertEventSnapshot[] };
  await prisma.securityLoginAlert.update({
    where: { id: existing.id },
    data: {
      last_seen_at: at,
      occurrences: { increment: 1 },
      details: { match: prev.match ?? f.match, events: pushAlertEvent(prev.events ?? [], snap) } as Prisma.InputJsonValue,
      ...(decision === "touch" ? {} : { user_ids: mergeUserIds(existing.user_ids, f.userIds) }),
      ...(decision === "reopen" ? { status: "open", risk: f.risk } : {})
    }
  });
  if (decision === "reopen" && f.risk === "high") await notifyHighRisk(tenantId, existing.id, f, snap);
}

/** Muvaffaqiyatli kirishdan keyin: jurnalga yozish va qoidalarni tekshirish. Xato kirishni buzmaydi. */
export async function recordLoginAndDetect(ev: LoginEventInput): Promise<void> {
  const at = new Date();
  const ip = normalizeIp(ev.ip);
  const row = await prisma.authLoginEvent.create({
    data: {
      tenant_id: ev.tenantId,
      user_id: ev.userId,
      platform: ev.platform,
      device_id: ev.deviceId,
      device_name: ev.deviceName?.slice(0, 255) ?? null,
      ip_address: ip,
      user_agent: ev.userAgent
    }
  });
  const snap: AlertEventSnapshot = {
    user_id: ev.userId,
    at: at.toISOString(),
    platform: ev.platform,
    ip,
    device_id: ev.deviceId,
    device_name: ev.deviceName
  };
  for (const f of await detect(ev, row.id, at)) {
    await applyFinding(ev.tenantId, f, snap, at);
  }
}
