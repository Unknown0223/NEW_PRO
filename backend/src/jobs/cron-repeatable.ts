import type { Queue } from "bullmq";

/** Worker bo‘lsa API setInterval o‘rniga shu joblar ishlaydi (P1-8). */
export const CRON_JOB_ORDER_AUTO_CLOSE = "cron_order_auto_close";
export const CRON_JOB_PRODUCT_PRICE = "cron_product_price_schedule";

const AUTO_CLOSE_EVERY_MS = Number.parseInt(process.env.CHECK_INTERVAL_MS ?? "3600000", 10);
const PRICE_EVERY_MS = Number.parseInt(process.env.PRICE_SCHEDULE_CHECK_MS ?? "60000", 10);

export async function registerCronRepeatableJobs(queue: Queue): Promise<void> {
  await queue.add(
    CRON_JOB_ORDER_AUTO_CLOSE,
    {},
    {
      jobId: "cron:order-auto-close",
      repeat: { every: AUTO_CLOSE_EVERY_MS },
      removeOnComplete: 20,
      removeOnFail: 50
    }
  );
  await queue.add(
    CRON_JOB_PRODUCT_PRICE,
    {},
    {
      jobId: "cron:product-price-schedule",
      repeat: { every: PRICE_EVERY_MS },
      removeOnComplete: 20,
      removeOnFail: 50
    }
  );
}

export async function processCronBackgroundJob(name: string): Promise<unknown> {
  if (name === CRON_JOB_ORDER_AUTO_CLOSE) {
    const { runAutoClose, runLowStockNotifications } = await import("../lib/order-auto-cron");
    const close = await runAutoClose();
    const low = await runLowStockNotifications();
    return { ok: true, close, low };
  }
  if (name === CRON_JOB_PRODUCT_PRICE) {
    const { applyDueProductPriceSchedules } = await import(
      "../modules/products/product-price-schedules.service"
    );
    const r = await applyDueProductPriceSchedules();
    return { ok: true, result: r };
  }
  return null;
}
