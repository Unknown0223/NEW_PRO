/**
 * Konsignatsiya oylik yopilish va qarzdorlik sanalarini avtomatik yangilash.
 * Kun/soat tenant mintaqasida; 15 daqiqada bir (oldingi 6 soat kechikib qolardi).
 */
import { reconcileAllTenantsConsignmentClosures } from "../modules/consignment/consignment-month-closure.service";

const CHECK_INTERVAL_MS = Number.parseInt(
  process.env.CONSIGNMENT_CLOSURE_CHECK_MS ?? String(15 * 60 * 1000),
  10
);

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await reconcileAllTenantsConsignmentClosures();
  } catch (err) {
    console.error("[consignment-closure-cron] error:", err);
  } finally {
    running = false;
  }
}

export function enableConsignmentClosureCron(): void {
  if (intervalHandle != null) return;
  void tick();
  intervalHandle = setInterval(() => {
    void tick();
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
