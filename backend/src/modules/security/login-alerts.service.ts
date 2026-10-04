import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { normalizeWhitelistEntry, type LoginAlertStatus } from "./login-alerts.pure";

export type LoginAlertFilters = {
  status?: LoginAlertStatus | "all";
  risk?: string;
  kind?: string;
  user_id?: number;
  from?: Date;
  to?: Date;
  q?: string;
  page: number;
  limit: number;
};

export type AlertUser = { id: number; name: string; login: string; role: string; is_active: boolean };

const userSelect = {
  id: true,
  login: true,
  role: true,
  is_active: true,
  name: true,
  first_name: true,
  last_name: true,
  middle_name: true
} as const;

async function loadUsers(tenantId: number, ids: number[]): Promise<Map<number, AlertUser>> {
  if (!ids.length) return new Map();
  const rows = await prisma.user.findMany({ where: { tenant_id: tenantId, id: { in: ids } }, select: userSelect });
  return new Map(rows.map((u) => [u.id, { id: u.id, name: toFio(u), login: u.login, role: u.role, is_active: u.is_active }]));
}

async function matchingUserIds(tenantId: number, q: string): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      OR: [
        { login: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { first_name: { contains: q, mode: "insensitive" } },
        { last_name: { contains: q, mode: "insensitive" } }
      ]
    },
    select: { id: true },
    take: 200
  });
  return rows.map((r) => r.id);
}

type AlertRow = Prisma.SecurityLoginAlertGetPayload<object>;

function toDto(row: AlertRow, users: Map<number, AlertUser>) {
  const details = (row.details ?? {}) as { match?: Record<string, unknown>; events?: Array<Record<string, unknown>> };
  const last = details.events?.at(-1);
  return {
    id: row.id,
    kind: row.kind,
    risk: row.risk,
    status: row.status,
    occurrences: row.occurrences,
    first_seen_at: row.first_seen_at.toISOString(),
    last_seen_at: row.last_seen_at.toISOString(),
    match: details.match ?? {},
    last_device_name: (last?.device_name as string | null | undefined) ?? null,
    last_ip: (last?.ip as string | null | undefined) ?? null,
    users: row.user_ids.map((id) => users.get(id) ?? { id, name: `#${id}`, login: "", role: "", is_active: false }),
    reviewed_at: row.reviewed_at?.toISOString() ?? null,
    reviewed_by_user_id: row.reviewed_by_user_id,
    review_note: row.review_note
  };
}

export type LoginAlertDto = ReturnType<typeof toDto>;

export async function listLoginAlerts(tenantId: number, f: LoginAlertFilters) {
  const where: Prisma.SecurityLoginAlertWhereInput = { tenant_id: tenantId };
  if (f.status && f.status !== "all") where.status = f.status;
  if (f.risk) where.risk = f.risk;
  if (f.kind) where.kind = f.kind;
  if (f.from || f.to) where.last_seen_at = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const userFilter: number[] = [];
  if (f.user_id) userFilter.push(f.user_id);
  if (f.q?.trim()) {
    const ids = await matchingUserIds(tenantId, f.q.trim());
    if (!ids.length) return { data: [], total: 0, page: f.page, limit: f.limit, open_counts: await openCounts(tenantId) };
    userFilter.push(...ids);
  }
  if (userFilter.length) where.user_ids = { hasSome: userFilter };

  const [rows, total] = await Promise.all([
    prisma.securityLoginAlert.findMany({
      where,
      orderBy: [{ last_seen_at: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.limit,
      take: f.limit
    }),
    prisma.securityLoginAlert.count({ where })
  ]);
  const users = await loadUsers(tenantId, [...new Set(rows.flatMap((r) => r.user_ids))]);
  return { data: rows.map((r) => toDto(r, users)), total, page: f.page, limit: f.limit, open_counts: await openCounts(tenantId) };
}

async function openCounts(tenantId: number): Promise<Record<string, number>> {
  const rows = await prisma.securityLoginAlert.groupBy({
    by: ["risk"],
    where: { tenant_id: tenantId, status: "open" },
    _count: { _all: true }
  });
  return Object.fromEntries(rows.map((r) => [r.risk, r._count._all]));
}

/** Ogohlantirishga tegishli kirishlar: qurilma / IP kuni / foydalanuvchi bo'yicha. */
function eventsWhere(tenantId: number, row: AlertRow): Prisma.AuthLoginEventWhereInput {
  const m = ((row.details ?? {}) as { match?: Record<string, unknown> }).match ?? {};
  const since = new Date(row.first_seen_at.getTime() - 30 * 86_400_000);
  if (row.kind === "shared_device" && typeof m.device_id === "string") {
    return { tenant_id: tenantId, device_id: m.device_id, created_at: { gte: since } };
  }
  if (row.kind === "shared_ip" && typeof m.ip === "string" && typeof m.day === "string") {
    const start = new Date(`${m.day}T00:00:00+05:00`);
    return {
      tenant_id: tenantId,
      ip_address: m.ip,
      created_at: { gte: start, lt: new Date(start.getTime() + 86_400_000) }
    };
  }
  return { tenant_id: tenantId, user_id: { in: row.user_ids }, created_at: { gte: since } };
}

export async function getLoginAlert(tenantId: number, id: number) {
  const row = await prisma.securityLoginAlert.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  const [events, sessions] = await Promise.all([
    prisma.authLoginEvent.findMany({ where: eventsWhere(tenantId, row), orderBy: { created_at: "desc" }, take: 200 }),
    prisma.refreshToken.findMany({
      where: { tenant_id: tenantId, user_id: { in: row.user_ids }, revoked_at: null, expires_at: { gt: new Date() } },
      select: { id: true, user_id: true, device_name: true, device_id: true, ip_address: true, created_at: true },
      orderBy: { created_at: "desc" },
      take: 100
    })
  ]);
  const ids = [...new Set([...row.user_ids, ...events.map((e) => e.user_id), ...(row.reviewed_by_user_id ? [row.reviewed_by_user_id] : [])])];
  const users = await loadUsers(tenantId, ids);
  return {
    ...toDto(row, users),
    reviewed_by: row.reviewed_by_user_id ? users.get(row.reviewed_by_user_id)?.name ?? null : null,
    events: events.map((e) => ({
      id: e.id,
      at: e.created_at.toISOString(),
      user: users.get(e.user_id) ?? null,
      platform: e.platform,
      device_id: e.device_id,
      device_name: e.device_name,
      ip: e.ip_address,
      user_agent: e.user_agent
    })),
    active_sessions: sessions.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      device_name: s.device_name,
      device_id: s.device_id,
      ip: s.ip_address,
      since: s.created_at.toISOString()
    }))
  };
}

export async function reviewLoginAlert(
  tenantId: number,
  id: number,
  actorId: number,
  input: { status: LoginAlertStatus; note?: string | null }
) {
  const row = await prisma.securityLoginAlert.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
  if (!row) throw new Error("NOT_FOUND");
  const reopened = input.status === "open";
  await prisma.securityLoginAlert.update({
    where: { id },
    data: {
      status: input.status,
      review_note: input.note?.trim() || null,
      reviewed_by_user_id: reopened ? null : actorId,
      reviewed_at: reopened ? null : new Date()
    }
  });
  return getLoginAlert(tenantId, id);
}

/** Akkauntni barcha qurilmalardan chiqarish (refresh tokenlar bekor; ilova / brauzer qayta login so'raydi). */
export async function revokeUserSessions(tenantId: number, alertId: number, userId: number) {
  const row = await prisma.securityLoginAlert.findFirst({ where: { id: alertId, tenant_id: tenantId }, select: { user_ids: true } });
  if (!row) throw new Error("NOT_FOUND");
  if (!row.user_ids.includes(userId)) throw new Error("USER_NOT_IN_ALERT");
  const r = await prisma.refreshToken.updateMany({
    where: { tenant_id: tenantId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() }
  });
  return { revoked: r.count };
}

export async function listIpWhitelist(tenantId: number) {
  const rows = await prisma.securityIpWhitelist.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "asc" } });
  return rows.map((r) => ({ id: r.id, cidr: r.cidr, label: r.label, created_at: r.created_at.toISOString() }));
}

export async function addIpWhitelist(tenantId: number, actorId: number, input: { cidr: string; label?: string | null }) {
  const cidr = normalizeWhitelistEntry(input.cidr);
  if (!cidr) throw new Error("INVALID_IP");
  const exists = await prisma.securityIpWhitelist.findFirst({ where: { tenant_id: tenantId, cidr }, select: { id: true } });
  if (exists) throw new Error("DUPLICATE_IP");
  const r = await prisma.securityIpWhitelist.create({
    data: { tenant_id: tenantId, cidr, label: input.label?.trim() || null, created_by_user_id: actorId }
  });
  return { id: r.id, cidr: r.cidr, label: r.label, created_at: r.created_at.toISOString() };
}

export async function deleteIpWhitelist(tenantId: number, id: number) {
  const r = await prisma.securityIpWhitelist.deleteMany({ where: { id, tenant_id: tenantId } });
  if (!r.count) throw new Error("NOT_FOUND");
}
