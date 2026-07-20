import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  appendErrorEvent,
  type AppendErrorEventInput,
  type ErrorEventPlatform,
  type ErrorEventSeverity
} from "../../lib/error-event";

export type ListErrorEventsQuery = {
  user_id?: number;
  source?: string;
  module?: string;
  search?: string;
  from?: string;
  to?: string;
  request_id?: string;
  page?: number;
  limit?: number;
};

export type MobileErrorIngestBody = {
  message: string;
  error_code?: string;
  request_id?: string;
  path?: string;
  method?: string;
  http_status?: number;
  module?: string;
  severity?: ErrorEventSeverity;
  platform?: ErrorEventPlatform;
  apk_version?: string;
  device_name?: string;
  device_id?: string;
  occurred_at?: string;
  payload?: Record<string, unknown>;
};

function parseIsoDate(raw: string | undefined, endOfDay: boolean): Date | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function buildWhere(tenantId: number, q: ListErrorEventsQuery): Prisma.ErrorEventWhereInput {
  const where: Prisma.ErrorEventWhereInput = { tenant_id: tenantId };
  if (q.user_id != null && Number.isFinite(q.user_id) && q.user_id > 0) {
    where.user_id = Math.floor(q.user_id);
  }
  if (q.source === "mobile" || q.source === "backend") where.source = q.source;
  if (q.module?.trim()) where.module = q.module.trim().slice(0, 64);
  if (q.request_id?.trim()) where.request_id = q.request_id.trim().slice(0, 64);

  const from = parseIsoDate(q.from, false);
  const to = parseIsoDate(q.to, true);
  if (from || to) {
    where.occurred_at = {};
    if (from) where.occurred_at.gte = from;
    if (to) where.occurred_at.lte = to;
  }

  const search = q.search?.trim();
  if (search) {
    where.OR = [
      { message: { contains: search, mode: "insensitive" } },
      { error_code: { contains: search, mode: "insensitive" } },
      { path: { contains: search, mode: "insensitive" } },
      { request_id: { contains: search, mode: "insensitive" } }
    ];
  }
  return where;
}

function mapRow(r: {
  id: number;
  tenant_id: number;
  user_id: number | null;
  source: string;
  severity: string;
  occurred_at: Date;
  created_at: Date;
  request_id: string | null;
  http_status: number | null;
  error_code: string | null;
  message: string;
  path: string | null;
  method: string | null;
  platform: string;
  apk_version: string | null;
  device_name: string | null;
  device_id: string | null;
  module: string | null;
  payload: Prisma.JsonValue;
  user?: { id: number; login: string; name: string; role: string } | null;
}) {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    user_id: r.user_id,
    user_login: r.user?.login ?? null,
    user_name: r.user?.name ?? null,
    user_role: r.user?.role ?? null,
    source: r.source,
    severity: r.severity,
    occurred_at: r.occurred_at.toISOString(),
    created_at: r.created_at.toISOString(),
    request_id: r.request_id,
    http_status: r.http_status,
    error_code: r.error_code,
    message: r.message,
    path: r.path,
    method: r.method,
    platform: r.platform,
    apk_version: r.apk_version,
    device_name: r.device_name,
    device_id: r.device_id,
    module: r.module,
    payload: r.payload
  };
}

export async function listErrorEvents(tenantId: number, q: ListErrorEventsQuery) {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(200, Math.max(1, q.limit ?? 50));
  const where = buildWhere(tenantId, q);
  const [total, rows] = await Promise.all([
    prisma.errorEvent.count({ where }),
    prisma.errorEvent.findMany({
      where,
      orderBy: { occurred_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, login: true, name: true, role: true } }
      }
    })
  ]);
  return { data: rows.map(mapRow), total, page, limit };
}

export async function getErrorEventDetail(tenantId: number, id: number) {
  const row = await prisma.errorEvent.findFirst({
    where: { id, tenant_id: tenantId },
    include: { user: { select: { id: true, login: true, name: true, role: true } } }
  });
  if (!row) return null;

  const related =
    row.request_id != null && row.request_id.length > 0
      ? await prisma.errorEvent.findMany({
          where: {
            tenant_id: tenantId,
            request_id: row.request_id,
            id: { not: row.id }
          },
          orderBy: { occurred_at: "asc" },
          take: 50,
          include: { user: { select: { id: true, login: true, name: true, role: true } } }
        })
      : [];

  return {
    event: mapRow(row),
    related: related.map(mapRow)
  };
}

export async function errorEventsMeta(tenantId: number) {
  const [sources, modules, users] = await Promise.all([
    prisma.errorEvent.groupBy({
      by: ["source"],
      where: { tenant_id: tenantId },
      _count: { _all: true }
    }),
    prisma.errorEvent.groupBy({
      by: ["module"],
      where: { tenant_id: tenantId, module: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { module: "desc" } },
      take: 30
    }),
    prisma.errorEvent.findMany({
      where: { tenant_id: tenantId, user_id: { not: null } },
      distinct: ["user_id"],
      select: {
        user_id: true,
        user: { select: { id: true, login: true, name: true, role: true } }
      },
      take: 500
    })
  ]);

  return {
    sources: sources.map((s) => ({ source: s.source, count: s._count._all })),
    modules: modules
      .filter((m) => m.module)
      .map((m) => ({ module: m.module as string, count: m._count._all })),
    users: users
      .filter((u) => u.user)
      .map((u) => ({
        id: u.user!.id,
        login: u.user!.login,
        name: u.user!.name,
        role: u.user!.role
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
  };
}

export async function ingestMobileErrorEvent(
  tenantId: number,
  userId: number,
  body: MobileErrorIngestBody
): Promise<{ id: number } | null> {
  const platform: ErrorEventPlatform =
    body.platform === "ios" || body.platform === "android" ? body.platform : "android";

  let occurredAt: Date | undefined;
  if (body.occurred_at) {
    const d = new Date(body.occurred_at);
    if (!Number.isNaN(d.getTime())) occurredAt = d;
  }

  const input: AppendErrorEventInput = {
    tenantId,
    userId,
    source: "mobile",
    severity: body.severity === "fatal" ? "fatal" : "error",
    occurredAt,
    requestId: body.request_id,
    httpStatus: body.http_status ?? null,
    errorCode: body.error_code,
    message: body.message,
    path: body.path,
    method: body.method,
    platform,
    apkVersion: body.apk_version,
    deviceName: body.device_name,
    deviceId: body.device_id,
    module: body.module,
    payload: body.payload
  };
  return appendErrorEvent(input);
}
