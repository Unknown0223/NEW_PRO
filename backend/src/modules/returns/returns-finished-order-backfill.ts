import { logger } from "../../config/logger";

/**
 * Eski yakuniy vozvrat-zakazlar uchun alohida refund yozilmaydi.
 * Vedomost hujjatning o‘zini ko‘rsatadi. Ikkinchi yozuv izoh va kartani buzadi.
 */
export async function backfillFinishedReturnOrderRefunds(): Promise<{ created: number; scanned: number }> {
  return { created: 0, scanned: 0 };
}

export function startFinishedReturnOrderBackfill(): void {
  void backfillFinishedReturnOrderRefunds()
    .then((r) => {
      if (r.created > 0) {
        logger.info(r, "Finished return orders posted to client balance");
      }
    })
    .catch((err) => {
      logger.error({ err }, "Finished return order backfill failed");
    });
}
