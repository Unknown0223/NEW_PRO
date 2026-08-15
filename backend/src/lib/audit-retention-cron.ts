/**
 * Audit / jurnal retention cron — har 24 soatda `runAuditRetentionPurge`.
 * Activity (90 kun) ham shu yerdan chaqiriladi; alohida activity cron kerak emas.
 * Fotootchet rasm kontenti (default 60 kun) ham shu cycle da tozalanadi.
 */
import { env } from "../config/env";
import { runAuditRetentionPurge } from "../modules/audit/audit-retention.service";
import { purgeExpiredPhotoContent } from "../modules/clients/client-photo-retention.service";

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

async function runOnce(): Promise<void> {
  const result = await runAuditRetentionPurge();
  const t = result.totals;
  const removed =
    t.tenant_audit_events +
    t.client_audit_logs +
    t.access_logs +
    t.order_status_logs +
    t.order_change_logs +
    t.slot_audit_entries +
    t.client_merge_logs +
    t.user_activity_events;
  if (removed > 0) {
    console.log(
      "[audit-retention] purged %d rows (audit≤%d d, activity≤%d d): %j",
      removed,
      result.default_audit_days,
      result.activity_days,
      t
    );
  }

  const photos = await purgeExpiredPhotoContent();
  if (photos.purged > 0) {
    console.log(
      "[photo-retention] purged image content for %d photos (≤%d d, storage_deleted=%d)",
      photos.purged,
      photos.retention_days,
      photos.storage_deleted
    );
  }
}

export function enableAuditRetentionCron(): void {
  if (timer != null) return;
  setTimeout(() => {
    void runOnce().catch((err) => console.error("[audit-retention] error:", err));
  }, 90_000);
  timer = setInterval(() => {
    void runOnce().catch((err) => console.error("[audit-retention] error:", err));
  }, RUN_INTERVAL_MS);
  console.log(
    "[audit-retention] cron enabled (audit = %d days, activity = %d days, photo content = %d days)",
    env.AUDIT_RETENTION_DAYS,
    env.ACTIVITY_RETENTION_DAYS,
    env.PHOTO_CONTENT_RETENTION_DAYS
  );
}

export function disableAuditRetentionCron(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Test / qo‘lda bir marta. */
export { runOnce as runAuditRetentionCronOnce };
