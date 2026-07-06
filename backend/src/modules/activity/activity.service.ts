import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { sanitizePayloadForAudit } from "../../lib/tenant-audit";
import {
  isActivityEventType,
  isTrackedModule,
  resolveEntityHistory,
  type ActivityEventType
} from "./activity.constants";

const MAX_BATCH = 50;
const STR = (v: unknown, max: number): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

export type RawActivityEvent = {
  event_type?: unknown;
  module?: unknown;
  section?: unknown;
  entity_type?: unknown;
  entity_id?: unknown;
  route?: unknown;
  label?: unknown;
  duration_ms?: unknown;
  meta?: unknown;
};

/** Batch ingestion — faqat oq ro'yxatdagi modullar va to'g'ri event tiplari saqlanadi. */
export async function ingestActivityEvents(
  tenantId: number,
  actorUserId: number | null,
  events: RawActivityEvent[]
): Promise<{ accepted: number; rejected: number }> {
  if (!Array.isArray(events) || events.length === 0) return { accepted: 0, rejected: 0 };
  const slice = events.slice(0, MAX_BATCH);
  let rejected = events.length - slice.length;

  const rows: Prisma.UserActivityEventCreateManyInput[] = [];
  for (const e of slice) {
    const event_type = e.event_type;
    const module = e.module;
    if (!isActivityEventType(event_type) || !isTrackedModule(module)) {
      rejected += 1;
      continue;
    }
    let durationMs: number | null = null;
    if (e.duration_ms != null) {
      const n = Number(e.duration_ms);
      if (Number.isFinite(n) && n >= 0) durationMs = Math.min(Math.floor(n), 86_400_000);
    }
    const meta =
      e.meta != null && typeof e.meta === "object" ? sanitizePayloadForAudit(e.meta) : {};
    rows.push({
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      event_type: event_type as ActivityEventType,
      module: module as string,
      section: STR(e.section, 64),
      entity_type: STR(e.entity_type, 64),
      entity_id: STR(e.entity_id, 64),
      route: STR(e.route, 255),
      label: STR(e.label, 255),
      duration_ms: durationMs,
      meta: meta as Prisma.InputJsonValue
    });
  }

  if (rows.length > 0) {
    await prisma.userActivityEvent.createMany({ data: rows });
  }
  return { accepted: rows.length, rejected };
}

export type ListActivityQuery = {
  actor_user_id?: number;
  module?: string;
  section?: string;
  event_type?: string;
  entity_type?: string;
  entity_id?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

function buildActivityWhere(tenantId: number, q: ListActivityQuery): Prisma.UserActivityEventWhereInput {
  const where: Prisma.UserActivityEventWhereInput = { tenant_id: tenantId };
  if (q.actor_user_id != null && Number.isFinite(q.actor_user_id)) where.actor_user_id = Math.floor(q.actor_user_id);
  if (q.module?.trim()) where.module = q.module.trim();
  if (q.section?.trim()) where.section = q.section.trim();
  if (q.event_type?.trim()) where.event_type = q.event_type.trim();
  if (q.entity_type?.trim()) where.entity_type = q.entity_type.trim();
  if (q.entity_id?.trim()) where.entity_id = q.entity_id.trim();
  if (q.search?.trim()) {
    const s = q.search.trim();
    where.OR = [
      { route: { contains: s, mode: "insensitive" } },
      { label: { contains: s, mode: "insensitive" } }
    ];
  }
  if (q.from?.trim() || q.to?.trim()) {
    const created: Prisma.DateTimeFilter = {};
    if (q.from?.trim()) {
      const d = new Date(q.from.trim());
      if (!Number.isNaN(d.getTime())) created.gte = d;
    }
    if (q.to?.trim()) {
      const d = new Date(q.to.trim());
      if (!Number.isNaN(d.getTime())) created.lte = d;
    }
    if (Object.keys(created).length > 0) where.created_at = created;
  }
  return where;
}

export async function listActivityEvents(tenantId: number, q: ListActivityQuery) {
  const where = buildActivityWhere(tenantId, q);
  const [total, rows] = await Promise.all([
    prisma.userActivityEvent.count({ where }),
    prisma.userActivityEvent.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { actor: { select: { login: true, name: true } } }
    })
  ]);
  return {
    data: rows.map((r) => ({
      id: r.id,
      event_type: r.event_type,
      module: r.module,
      section: r.section,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      route: r.route,
      label: r.label,
      duration_ms: r.duration_ms,
      meta: r.meta,
      actor_user_id: r.actor_user_id,
      actor_login: r.actor?.login ?? null,
      actor_name: r.actor?.name ?? null,
      created_at: r.created_at.toISOString()
    })),
    total,
    page: q.page,
    limit: q.limit
  };
}

/** Filtr facetlari: modul, event_type bo'yicha sanoq. */
export async function activityMeta(tenantId: number) {
  const [byModule, byEvent] = await Promise.all([
    prisma.userActivityEvent.groupBy({
      by: ["module"],
      where: { tenant_id: tenantId },
      _count: { _all: true }
    }),
    prisma.userActivityEvent.groupBy({
      by: ["event_type"],
      where: { tenant_id: tenantId },
      _count: { _all: true }
    })
  ]);
  return {
    modules: byModule.map((m) => ({ module: m.module, count: m._count._all })),
    event_types: byEvent.map((e) => ({ event_type: e.event_type, count: e._count._all }))
  };
}

export type TimelineItem = {
  source: string;
  id: string;
  action: string;
  event_type?: string | null;
  actor_user_id: number | null;
  actor_login: string | null;
  detail: unknown;
  created_at: string;
};

/**
 * Birlashtirilgan per-entity tarix: generic audit + per-entity loglar + xatti-harakatlar.
 */
export async function entityHistoryTimeline(
  tenantId: number,
  entityType: string,
  entityId: string,
  limit = 200
): Promise<{ items: TimelineItem[]; entity_type: string; entity_id: string } | null> {
  const d = resolveEntityHistory(entityType);
  if (!d) return null;
  const numericId = Number(entityId);
  const hasNumericId = Number.isInteger(numericId) && numericId > 0;
  const items: TimelineItem[] = [];
  const actorIds = new Set<number>();

  const push = (it: Omit<TimelineItem, "actor_login">) => {
    if (it.actor_user_id) actorIds.add(it.actor_user_id);
    items.push({ ...it, actor_login: null });
  };

  // 1) Generic audit (TenantAuditEvent) — entity tipi audit qiymatlari bilan moslanadi
  const audit = await prisma.tenantAuditEvent.findMany({
    where: { tenant_id: tenantId, entity_type: { in: d.auditEntityTypes }, entity_id: entityId },
    orderBy: { created_at: "desc" },
    take: limit
  });
  for (const a of audit) {
    push({
      source: "audit",
      id: `audit:${a.id}`,
      action: a.action,
      actor_user_id: a.actor_user_id,
      detail: a.payload,
      created_at: a.created_at.toISOString()
    });
  }

  // 2) Xatti-harakatlar (UserActivityEvent)
  const acts = await prisma.userActivityEvent.findMany({
    where: { tenant_id: tenantId, entity_type: { in: d.activityEntityTypes }, entity_id: entityId },
    orderBy: { created_at: "desc" },
    take: limit
  });
  for (const a of acts) {
    push({
      source: "activity",
      id: `activity:${a.id}`,
      action: a.event_type,
      event_type: a.event_type,
      actor_user_id: a.actor_user_id,
      detail: { route: a.route, label: a.label, duration_ms: a.duration_ms, meta: a.meta },
      created_at: a.created_at.toISOString()
    });
  }

  // 3) Maxsus per-entity loglar
  if (hasNumericId && d.sources.includes("orderStatus")) {
    const logs = await prisma.orderStatusLog.findMany({
      where: { order_id: numericId },
      orderBy: { created_at: "desc" },
      take: limit
    });
    for (const l of logs) {
      push({
        source: "order_status",
        id: `order_status:${l.id}`,
        action: "status_change",
        actor_user_id: l.user_id,
        detail: { from_status: l.from_status, to_status: l.to_status },
        created_at: l.created_at.toISOString()
      });
    }
  }
  if (hasNumericId && d.sources.includes("orderChange")) {
    const logs = await prisma.orderChangeLog.findMany({
      where: { order_id: numericId },
      orderBy: { created_at: "desc" },
      take: limit
    });
    for (const l of logs) {
      push({
        source: "order_change",
        id: `order_change:${l.id}`,
        action: l.action,
        actor_user_id: l.user_id,
        detail: l.payload,
        created_at: l.created_at.toISOString()
      });
    }
  }
  if (hasNumericId && d.sources.includes("clientAudit")) {
    const logs = await prisma.clientAuditLog.findMany({
      where: { tenant_id: tenantId, client_id: numericId },
      orderBy: { created_at: "desc" },
      take: limit
    });
    for (const l of logs) {
      push({
        source: "client_audit",
        id: `client_audit:${l.id}`,
        action: l.action,
        actor_user_id: l.user_id,
        detail: l.detail,
        created_at: l.created_at.toISOString()
      });
    }
  }
  if (hasNumericId && d.sources.includes("accessLog")) {
    const logs = await prisma.accessLog.findMany({
      where: { tenant_id: tenantId, target_user_id: numericId },
      orderBy: { created_at: "desc" },
      take: limit
    });
    for (const l of logs) {
      push({
        source: "access_log",
        id: `access_log:${l.id}`,
        action: l.action_type,
        actor_user_id: l.actor_user_id,
        detail: { entity_type: l.entity_type, old_value: l.old_value, new_value: l.new_value },
        created_at: l.created_at.toISOString()
      });
    }
  }

  // Aktyor login'larini bir so'rovda olish
  if (actorIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...actorIds] } },
      select: { id: true, login: true }
    });
    const byId = new Map(users.map((u) => [u.id, u.login]));
    for (const it of items) {
      if (it.actor_user_id) it.actor_login = byId.get(it.actor_user_id) ?? null;
    }
  }

  items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { items: items.slice(0, limit), entity_type: entityType, entity_id: entityId };
}

/** Retention: eski xatti-harakat yozuvlarini o'chiradi. */
export async function purgeOldActivityEvents(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const res = await prisma.userActivityEvent.deleteMany({ where: { created_at: { lt: cutoff } } });
  return res.count;
}
