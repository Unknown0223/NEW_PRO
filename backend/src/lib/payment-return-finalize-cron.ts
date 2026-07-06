/**
 * Taymeri tugagan «Отклонено» (rejected) to'lovlarni qayta `pending_confirmation`
 * ga qaytaruvchi cron. Qarang: payment-return-finalize.service.ts.
 */
import { finalizeExpiredRejectedPayments } from "../modules/payments/payment-return-finalize.service";

const CHECK_INTERVAL_MS = Number.parseInt(process.env.PAYMENT_RETURN_FINALIZE_CHECK_MS ?? "60000", 10);

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function enablePaymentReturnFinalizeCron(): void {
  if (intervalHandle != null) return;
  intervalHandle = setInterval(() => {
    void finalizeExpiredRejectedPayments().catch((err) => {
      console.error("[payment-return-finalize-cron] finalize error:", err);
    });
  }, CHECK_INTERVAL_MS);
  console.log("[payment-return-finalize-cron] Timer started (interval = %d ms)", CHECK_INTERVAL_MS);
}

export function disablePaymentReturnFinalizeCron(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[payment-return-finalize-cron] Timer stopped.");
  }
}

export { finalizeExpiredRejectedPayments };
