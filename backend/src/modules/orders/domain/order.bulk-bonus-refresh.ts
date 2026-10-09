/**
 * Domain: Orders — guruh «Обновления бонуси» (yangi mexanizmga qayta hisoblash).
 */
import { prisma } from "../../../config/database";
import { getErrorCode } from "../../../lib/app-error";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import { invalidateDashboard, invalidateOrdersListCache, invalidateStock } from "../../../lib/redis-cache";
import { normalizeOrderType } from "../order-status";
import { updateOrderLines } from "./order.lines";

export type BulkOrderBonusRefreshResult = {
  updated: number[];
  failed: { id: number; error: string }[];
  skipped: { id: number; reason: string }[];
};

/**
 * Tanlangan «Новый» savdo zakazlarida bonuslarni yangi mexanizm (strategiya + stack) bilan
 * avtomatik qayta hisoblaydi. To‘lov qatorlari saqlanadi; sovg‘a qatorlari qayta yoziladi.
 */
export async function bulkRefreshOrderBonuses(
  tenantId: number,
  orderIds: number[],
  actorUserId: number | null,
  viewerRole?: string
): Promise<BulkOrderBonusRefreshResult> {
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  const updated: number[] = [];
  const failed: BulkOrderBonusRefreshResult["failed"] = [];
  const skipped: BulkOrderBonusRefreshResult["skipped"] = [];
  const warehouseIds = new Set<number>();

  const existingRows = await prisma.order.findMany({
    where: { id: { in: ids }, tenant_id: tenantId },
    select: {
      id: true,
      status: true,
      order_type: true,
      warehouse_id: true,
      items: {
        where: { is_bonus: false },
        select: { product_id: true, qty: true },
        orderBy: { id: "asc" }
      }
    }
  });
  const byId = new Map(existingRows.map((r) => [r.id, r]));

  for (const id of ids) {
    try {
      const existing = byId.get(id);
      if (!existing) {
        failed.push({ id, error: "NOT_FOUND" });
        continue;
      }
      if (existing.status !== "new") {
        skipped.push({ id, reason: "NOT_NEW" });
        continue;
      }
      if (normalizeOrderType(existing.order_type) !== "order") {
        skipped.push({ id, reason: "BAD_ORDER_TYPE" });
        continue;
      }
      const items = existing.items
        .map((it) => ({
          product_id: it.product_id,
          qty: Number(it.qty)
        }))
        .filter((it) => Number.isFinite(it.qty) && it.qty > 0);
      if (items.length === 0) {
        skipped.push({ id, reason: "EMPTY_ITEMS" });
        continue;
      }

      await updateOrderLines(
        tenantId,
        id,
        { items, apply_bonus: true, apply_discount: true },
        viewerRole,
        actorUserId
      );
      if (existing.warehouse_id != null) warehouseIds.add(existing.warehouse_id);
      updated.push(id);
    } catch (e) {
      failed.push({ id, error: getErrorCode(e) ?? "UNKNOWN" });
    }
  }

  if (updated.length > 0) {
    emitOrderUpdated(tenantId, updated[0]!);
    void invalidateOrdersListCache(tenantId);
    void invalidateDashboard(tenantId);
    for (const whId of warehouseIds) {
      void invalidateStock(tenantId, whId);
    }
  }

  return { updated, failed, skipped };
}
