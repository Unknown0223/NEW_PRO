import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { resolveTenantSlugAlias } from "../../lib/tenant-slug-alias";
import { resolveUserPermissionKeys } from "../access/rbac.resolve";

export type StaffIdentity = {
  kind: "staff";
  tenantId: number;
  user: { id: number; name: string; role: string; login: string; code: string | null; supervisor_user_id: number | null };
  perms: Set<string>;
};

export type ClientIdentity = {
  kind: "client";
  tenantId: number;
  clientIds: number[];
  /** Tanlangan mijoz (bir nechta ulanish bo'lsa). */
  clientId: number;
  clientName: string;
};

export type PendingIdentity = { kind: "pending"; tenantId: number };
export type NoIdentity = { kind: "none"; tenantId: number };
export type Identity = StaffIdentity | ClientIdentity | PendingIdentity | NoIdentity;

let tenantCache: { slug: string; id: number; name: string; at: number } | null = null;

export async function resolveBotTenant(): Promise<{ id: number; name: string } | null> {
  const slug = env.TG_APP_TENANT_SLUG;
  if (!slug) return null;
  if (tenantCache && tenantCache.slug === slug && Date.now() - tenantCache.at < 300_000) return tenantCache;
  const t = await prisma.tenant.findFirst({
    where: { slug: resolveTenantSlugAlias(slug), is_active: true },
    select: { id: true, name: true }
  });
  if (!t) return null;
  tenantCache = { slug, id: t.id, name: t.name, at: Date.now() };
  return tenantCache;
}

export async function loadStaffIdentity(tenantId: number, telegramId: bigint): Promise<StaffIdentity | null> {
  const link = await prisma.telegramStaffLink.findUnique({
    where: { telegram_id: telegramId },
    select: { user_id: true, tenant_id: true }
  });
  if (!link || link.tenant_id !== tenantId) return null;
  const user = await prisma.user.findFirst({
    where: { id: link.user_id, tenant_id: tenantId, is_active: true },
    select: { id: true, name: true, role: true, login: true, code: true, supervisor_user_id: true }
  });
  if (!user) return null;
  const perms = await resolveUserPermissionKeys(tenantId, user.id, user.role);
  void prisma.telegramStaffLink
    .update({ where: { user_id: user.id }, data: { last_seen_at: new Date() } })
    .catch(() => undefined);
  return { kind: "staff", tenantId, user, perms };
}

/**
 * Kim ekanini aniqlash. Xodim ulanishi ustun: xodim Telegrami mijoz
 * ma'lumotlarini hech qachon ko'rmaydi.
 */
export async function resolveIdentity(tenantId: number, telegramId: bigint, activeClientId: number | null): Promise<Identity> {
  const staff = await loadStaffIdentity(tenantId, telegramId);
  if (staff) return staff;

  const links = await prisma.tgClientLink.findMany({
    where: { tenant_id: tenantId, telegram_id: telegramId, status: { in: ["active", "pending"] } },
    select: { id: true, client_id: true, status: true },
    orderBy: { linked_at: "asc" }
  });
  const activeIds = links.filter((l) => l.status === "active").map((l) => l.client_id);
  if (activeIds.length === 0) {
    return links.length > 0 ? { kind: "pending", tenantId } : { kind: "none", tenantId };
  }
  const clients = await prisma.client.findMany({
    where: { tenant_id: tenantId, id: { in: activeIds }, is_active: true, merged_into_client_id: null },
    select: { id: true, name: true }
  });
  if (clients.length === 0) return { kind: "none", tenantId };
  const chosen = clients.find((c) => c.id === activeClientId) ?? clients[0];
  void prisma.tgClientLink
    .updateMany({ where: { tenant_id: tenantId, telegram_id: telegramId, client_id: chosen.id }, data: { last_seen_at: new Date() } })
    .catch(() => undefined);
  return {
    kind: "client",
    tenantId,
    clientIds: clients.map((c) => c.id),
    clientId: chosen.id,
    clientName: chosen.name
  };
}

export function hasPerm(id: StaffIdentity, ...keys: string[]): boolean {
  return keys.some((k) => id.perms.has(k));
}

export async function logAttempt(input: {
  tenantId: number;
  telegramId: bigint;
  kind: string;
  ok: boolean;
  reason?: string;
  clientId?: number | null;
  userId?: number | null;
}): Promise<void> {
  await prisma.tgAuthAttempt
    .create({
      data: {
        tenant_id: input.tenantId,
        telegram_id: input.telegramId,
        kind: input.kind,
        ok: input.ok,
        reason: input.reason?.slice(0, 64) ?? null,
        client_id: input.clientId ?? null,
        user_id: input.userId ?? null
      }
    })
    .catch(() => undefined);
}

export async function recentFailTimes(telegramId: bigint): Promise<Date[]> {
  const rows = await prisma.tgAuthAttempt.findMany({
    where: { telegram_id: telegramId, ok: false, created_at: { gte: new Date(Date.now() - 3600_000) } },
    select: { created_at: true },
    orderBy: { created_at: "desc" },
    take: 20
  });
  return rows.map((r) => r.created_at);
}
