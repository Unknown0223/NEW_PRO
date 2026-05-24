/**
 * Rejalashtirilgan mahsulot narxlari: `effective_at` o‘tgach `product_prices` ga qo‘llash.
 */
import { applyDueProductPriceSchedules } from "../modules/products/product-price-schedules.service";

const CHECK_INTERVAL_MS = Number.parseInt(process.env.PRICE_SCHEDULE_CHECK_MS ?? "60000", 10);

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function enableProductPriceScheduleCron(): void {
  if (intervalHandle != null) return;
  intervalHandle = setInterval(() => {
    void applyDueProductPriceSchedules().catch((err) => {
      console.error("[product-price-schedule-cron] applyDue error:", err);
    });
  }, CHECK_INTERVAL_MS);
  console.log("[product-price-schedule-cron] Timer started (interval = %d ms)", CHECK_INTERVAL_MS);
}

export function disableProductPriceScheduleCron(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[product-price-schedule-cron] Timer stopped.");
  }
}

/** Test yoki bir martalik ishga tushirish. */
export { applyDueProductPriceSchedules };
