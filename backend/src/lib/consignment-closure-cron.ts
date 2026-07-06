/**
 * Konsignatsiya oylik yopilish va qarzdorlik yopilgan sanalarni avtomatik yangilash.
 */
import { reconcileAllTenantsConsignmentClosures } from "../modules/consignment/consignment-month-closure.service";

const CHECK_INTERVAL_MS = Number.parseInt(
  process.env.CONSIGNMENT_CLOSURE_CHECK_MS ?? String(6 * 60 * 60 * 1000),
  10
);

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function enableConsignmentClosureCron(): void {
  if (intervalHandle != null) return;
  intervalHandle = setInterval(() => {
    void reconcileAllTenantsConsignmentClosures().catch((err) => {
      console.error("[consignment-closure-cron] error:", err);
    });
  }, CHECK_INTERVAL_MS);
  console.log("[consignment-closure-cron] Timer started (interval = %d ms)", CHECK_INTERVAL_MS);
}

export function disableConsignmentClosureCron(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[consignment-closure-cron] Timer stopped.");
  }
}

export { reconcileAllTenantsConsignmentClosures };
