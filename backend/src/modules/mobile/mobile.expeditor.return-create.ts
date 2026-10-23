/**
 * Dastavchik qaytarishi: to‘liq qatorlar zakazni `returned` qiladi,
 * qisman miqdor esa alohida vozvrat hujjati ochadi.
 */
import { prisma } from "../../config/database";
import { updateOrderStatus } from "../orders/domain/order.lifecycle";
import { assertMobilePhotoReportForClient } from "./mobile-agent-sync.config.service";
import { assertExpeditorOwnsOrder, loadExpeditorMobileConfig } from "./mobile.expeditor.orders.service";
import { isFullOrderItemReturn, partialItemsToReturnLines } from "./mobile.expeditor.partial-return";

export async function createMobileExpeditorPartialReturn(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: {
    reason: string;
    note?: string | null;
    items?: Array<{ order_item_id: number; qty: number }>;
  }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_partial_return_edit === false) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered" && order.status !== "delivering") throw new Error("BAD_STATUS");

  const reason = input.reason.trim();
  if (!reason) throw new Error("BAD_REASON");
  if (!input.items?.length) throw new Error("BAD_RETURN_QTY");

  const orderItems = await prisma.orderItem.findMany({
    where: { order_id: orderId, order: { tenant_id: tenantId } },
    select: {
      id: true,
      qty: true,
      is_bonus: true,
      product_id: true,
      product: { select: { sku: true, name: true } }
    }
  });
  const byId = new Map(orderItems.map((i) => [i.id, i]));
  const lines: string[] = [];
  for (const row of input.items) {
    const line = byId.get(row.order_item_id);
    if (!line) throw new Error("BAD_RETURN_ITEM");
    const maxQty = Number(line.qty);
    if (!Number.isFinite(row.qty) || row.qty <= 0 || row.qty > maxQty) throw new Error("BAD_RETURN_QTY");
    lines.push(`${line.product.sku} ${line.product.name}: ${row.qty}/${maxQty}`);
  }

  const normalized = orderItems.map((line) => ({
    id: line.id,
    qty: Number(line.qty),
    product_id: line.product_id,
    is_bonus: line.is_bonus
  }));
  if (!isFullOrderItemReturn(normalized, input.items)) {
    if (order.status !== "delivered") throw new Error("ORDER_NOT_DELIVERED");
    const returnLines = partialItemsToReturnLines(normalized, input.items);
    if (returnLines.length === 0) throw new Error("BAD_RETURN_QTY");
    const { createPeriodReturn } = await import("../returns/returns-enhanced.create-period");
    return createPeriodReturn(
      tenantId,
      {
        client_id: order.client_id,
        order_id: orderId,
        lines: returnLines,
        note: input.note ?? null,
        refusal_reason_ref: reason
      },
      expeditorUserId
    );
  }

  await assertMobilePhotoReportForClient(tenantId, expeditorUserId, order.client_id, cfg);
  const noteParts = [`qaytarish: ${reason}`];
  if (lines.length) noteParts.push(`qatorlar: ${lines.join("; ")}`);
  if (input.note?.trim()) noteParts.push(input.note.trim());
  const noteLine = `[${noteParts.join(" | ")}]`;
  const nextComment = order.comment?.trim() ? `${order.comment.trim()}\n${noteLine}` : noteLine;
  await prisma.order.update({ where: { id: orderId }, data: { comment: nextComment } });
  return updateOrderStatus(tenantId, orderId, "returned", expeditorUserId, "expeditor");
}
