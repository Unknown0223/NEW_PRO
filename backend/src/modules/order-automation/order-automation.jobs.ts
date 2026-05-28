import { getBackgroundQueue } from "../../jobs/background-queue";

export type OrderAutoConfirmJobData = {
  tenant_id: number;
  schedule_id: number;
};

export async function enqueueOrderAutoConfirmJob(
  data: OrderAutoConfirmJobData,
  delayMs: number
): Promise<void> {
  try {
    const q = getBackgroundQueue();
    await q.add("order_auto_confirm", data, {
      delay: Math.max(0, Math.floor(delayMs)),
      removeOnComplete: 2000,
      removeOnFail: 8000,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 }
    });
  } catch {
    const { executeAutoConfirmSchedule } = await import("./order-automation.auto-confirm");
    if (delayMs <= 0) {
      await executeAutoConfirmSchedule(data.tenant_id, data.schedule_id);
    }
  }
}
