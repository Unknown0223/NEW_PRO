/**
 * UserActivityEvent retention cron — `ACTIVITY_RETENTION_DAYS` dan eski
 * xatti-harakat yozuvlarini davriy o'chiradi (har 24 soatda).
 */
import { env } from "../config/env";
import { purgeOldActivityEvents } from "../modules/activity/activity.service";

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

async function runOnce(): Promise<void> {
  const removed = await purgeOldActivityEvents(env.ACTIVITY_RETENTION_DAYS);
  if (removed > 0) {
    console.log("[activity-retention] purged %d events older than %d days", removed, env.ACTIVITY_RETENTION_DAYS);
  }
}

export function enableActivityRetentionCron(): void {
  if (timer != null) return;
  // Boshlanishidan biroz keyin bir marta, so'ng har 24 soatda.
  setTimeout(() => {
    void runOnce().catch((err) => console.error("[activity-retention] error:", err));
  }, 60_000);
  timer = setInterval(() => {
    void runOnce().catch((err) => console.error("[activity-retention] error:", err));
  }, RUN_INTERVAL_MS);
  console.log("[activity-retention] cron enabled (retention = %d days)", env.ACTIVITY_RETENTION_DAYS);
}

export function disableActivityRetentionCron(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
