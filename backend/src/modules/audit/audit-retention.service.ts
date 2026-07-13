/**
 * Yagona audit / jurnal retention — yoshga qarab tozalash.
 *
 * Default: audit store lar 730 kun; activity 90 kun (env).
 * Tenant `settings.audit_retention_days` (ixtiyoriy) audit store lar uchun override.
 */
import type { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { purgeOldActivityEvents } from "../activity/activity.service";

export const DEFAULT_AUDIT_RETENTION_DAYS = 730;

export type AuditRetentionCounts = {
  tenant_audit_events: number;
  client_audit_logs: number;
  access_logs: number;
  order_status_logs: number;
  order_change_logs: number;
  slot_audit_entries: number;
  client_merge_logs: number;
  user_activity_events: number;
};

export type AuditRetentionResult = {
  default_audit_days: number;
  activity_days: number;
  cutoff_audit_iso: string;
  cutoff_activity_iso: string;
  by_tenant: Array<{ tenant_id: number; days: number; counts: Omit<AuditRetentionCounts, "user_activity_events"> }>;
  totals: AuditRetentionCounts;
};

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

/** Tenant settings yoki env dan retention kunlari. */
export function resolveAuditRetentionDays(
  tenantSettings: Prisma.JsonValue | null | undefined,
  fallbackDays: number = env.AUDIT_RETENTION_DAYS
): number {
  const st = asRecord(tenantSettings);
  const raw = st.audit_retention_days;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return Math.max(1, Math.floor(fallbackDays));
}

function cutoffFromDays(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function purgeTenantAuditStores(
  tenantId: number,
  cutoff: Date
): Promise<Omit<AuditRetentionCounts, "user_activity_events">> {
  const [
    tenant_audit_events,
    client_audit_logs,
    access_logs,
    order_status_logs,
    order_change_logs,
    slot_audit_entries,
    client_merge_logs
  ] = await Promise.all([
    prisma.tenantAuditEvent
      .deleteMany({ where: { tenant_id: tenantId, created_at: { lt: cutoff } } })
      .then((r) => r.count),
    prisma.clientAuditLog
      .deleteMany({ where: { tenant_id: tenantId, created_at: { lt: cutoff } } })
      .then((r) => r.count),
    prisma.accessLog
      .deleteMany({ where: { tenant_id: tenantId, created_at: { lt: cutoff } } })
      .then((r) => r.count),
    // order_*_logs da tenant_id yo‘q — order orqali.
    prisma.orderStatusLog
      .deleteMany({
        where: { created_at: { lt: cutoff }, order: { tenant_id: tenantId } }
      })
      .then((r) => r.count),
    prisma.orderChangeLog
      .deleteMany({
        where: { created_at: { lt: cutoff }, order: { tenant_id: tenantId } }
      })
      .then((r) => r.count),
    prisma.slotAuditEntry
      .deleteMany({ where: { tenant_id: tenantId, created_at: { lt: cutoff } } })
      .then((r) => r.count),
    prisma.clientMergeLog
      .deleteMany({ where: { tenant_id: tenantId, merged_at: { lt: cutoff } } })
      .then((r) => r.count)
  ]);

  return {
    tenant_audit_events,
    client_audit_logs,
    access_logs,
    order_status_logs,
    order_change_logs,
    slot_audit_entries,
    client_merge_logs
  };
}

function emptyStoreCounts(): Omit<AuditRetentionCounts, "user_activity_events"> {
  return {
    tenant_audit_events: 0,
    client_audit_logs: 0,
    access_logs: 0,
    order_status_logs: 0,
    order_change_logs: 0,
    slot_audit_entries: 0,
    client_merge_logs: 0
  };
}

function addCounts(
  a: Omit<AuditRetentionCounts, "user_activity_events">,
  b: Omit<AuditRetentionCounts, "user_activity_events">
): Omit<AuditRetentionCounts, "user_activity_events"> {
  return {
    tenant_audit_events: a.tenant_audit_events + b.tenant_audit_events,
    client_audit_logs: a.client_audit_logs + b.client_audit_logs,
    access_logs: a.access_logs + b.access_logs,
    order_status_logs: a.order_status_logs + b.order_status_logs,
    order_change_logs: a.order_change_logs + b.order_change_logs,
    slot_audit_entries: a.slot_audit_entries + b.slot_audit_entries,
    client_merge_logs: a.client_merge_logs + b.client_merge_logs
  };
}

/**
 * Barcha tenantlar bo‘yicha audit store lar + activity retention.
 * Activity global (tenant setting siz) — `ACTIVITY_RETENTION_DAYS`.
 */
export async function runAuditRetentionPurge(opts?: {
  auditDays?: number;
  activityDays?: number;
  /** Faqat shu tenant (ops / test). */
  tenantId?: number;
  /** Activity purge ni o‘tkazib yuborish. */
  skipActivity?: boolean;
}): Promise<AuditRetentionResult> {
  const defaultAuditDays = Math.max(1, Math.floor(opts?.auditDays ?? env.AUDIT_RETENTION_DAYS));
  const activityDays = Math.max(1, Math.floor(opts?.activityDays ?? env.ACTIVITY_RETENTION_DAYS));
  const auditCutoff = cutoffFromDays(defaultAuditDays);
  const activityCutoff = cutoffFromDays(activityDays);

  const tenants = await prisma.tenant.findMany({
    where: opts?.tenantId != null ? { id: opts.tenantId } : undefined,
    select: { id: true, settings: true }
  });

  const by_tenant: AuditRetentionResult["by_tenant"] = [];
  let totalsStores = emptyStoreCounts();

  for (const t of tenants) {
    const days = resolveAuditRetentionDays(t.settings, defaultAuditDays);
    const cutoff = cutoffFromDays(days);
    const counts = await purgeTenantAuditStores(t.id, cutoff);
    by_tenant.push({ tenant_id: t.id, days, counts });
    totalsStores = addCounts(totalsStores, counts);
  }

  let user_activity_events = 0;
  if (!opts?.skipActivity) {
    user_activity_events = await purgeOldActivityEvents(activityDays);
  }

  return {
    default_audit_days: defaultAuditDays,
    activity_days: activityDays,
    cutoff_audit_iso: auditCutoff.toISOString(),
    cutoff_activity_iso: activityCutoff.toISOString(),
    by_tenant,
    totals: { ...totalsStores, user_activity_events }
  };
}

/** Faqat tenant_audit_events (eski skript mosligi). */
export async function purgeTenantAuditEventsOlderThan(days: number): Promise<number> {
  const cutoff = cutoffFromDays(Math.max(1, days));
  const r = await prisma.tenantAuditEvent.deleteMany({ where: { created_at: { lt: cutoff } } });
  return r.count;
}
