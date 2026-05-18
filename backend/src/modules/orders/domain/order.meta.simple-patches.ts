import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import { ORDER_LINES_EDITABLE_STATUSES } from "./order.lines";
import { assertOrderWarehouseBlockAssignment, enrichOrderDetailRow } from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderMetaInput
} from "./order.types";

export type OrderMetaPatchExisting = {
  status: string;
  warehouse_id: number | null;
  expeditor_user_id: number | null;
  payment_method_ref?: string | null;
  comment?: string | null;
  warehouse_block_id?: number | null;
};

export async function patchOrderMetaPaymentMethodOnly(
  tenantId: number,
  orderId: number,
  existing: OrderMetaPatchExisting,
  input: UpdateOrderMetaInput,
  actorUserId: number | null | undefined,
  viewerRole?: string
): Promise<OrderDetailRow> {
  if (existing.status === "cancelled") {
    throw new Error("ORDER_NOT_EDITABLE");
  }
  if (!ORDER_LINES_EDITABLE_STATUSES.has(existing.status)) {
    throw new Error("ORDER_NOT_EDITABLE");
  }
  const pmNext =
    input.payment_method_ref === null
      ? null
      : (input.payment_method_ref ?? "").trim().slice(0, 64) || null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { payment_method_ref: pmNext }
    });
    await tx.orderChangeLog.create({
      data: {
        order_id: orderId,
        user_id:
          actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null,
        action: "meta",
        payload: {
          payment_method_ref: {
            from: existing.payment_method_ref ?? null,
            to: pmNext
          }
        } as Prisma.InputJsonObject
      }
    });
    return tx.order.findFirstOrThrow({
      where: { id: orderId, tenant_id: tenantId },
      include: orderDetailInclude
    });
  });
  emitOrderUpdated(tenantId, orderId);
  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, viewerRole);
}

export async function patchOrderMetaCommentOnly(
  tenantId: number,
  orderId: number,
  existing: OrderMetaPatchExisting,
  input: UpdateOrderMetaInput,
  viewerRole?: string
): Promise<OrderDetailRow> {
  if (existing.status === "cancelled") {
    throw new Error("ORDER_NOT_EDITABLE");
  }
  const c = input.comment === null ? null : input.comment!.trim() || null;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { comment: c },
    include: orderDetailInclude
  });
  emitOrderUpdated(tenantId, orderId);
  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, viewerRole);
}

export async function patchOrderMetaBlockOnly(
  tenantId: number,
  orderId: number,
  existing: OrderMetaPatchExisting,
  input: UpdateOrderMetaInput,
  actorUserId: number | null | undefined,
  viewerRole?: string
): Promise<OrderDetailRow> {
  if (existing.status === "cancelled") {
    throw new Error("ORDER_NOT_EDITABLE");
  }
  if (!ORDER_LINES_EDITABLE_STATUSES.has(existing.status)) {
    throw new Error("ORDER_NOT_EDITABLE");
  }
  const logUserId =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const nextBlockId = input.warehouse_block_id ?? null;
  await assertOrderWarehouseBlockAssignment(
    tenantId,
    existing.warehouse_id,
    existing.expeditor_user_id,
    nextBlockId
  );
  const prevBlockId = existing.warehouse_block_id ?? null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { warehouse_block_id: nextBlockId }
    });
    if (prevBlockId !== nextBlockId) {
      await tx.orderChangeLog.create({
        data: {
          order_id: orderId,
          user_id: logUserId,
          action: "meta",
          payload: {
            warehouse_block_id: { from: prevBlockId, to: nextBlockId }
          } as Prisma.InputJsonObject
        }
      });
    }
    return tx.order.findFirstOrThrow({
      where: { id: orderId, tenant_id: tenantId },
      include: orderDetailInclude
    });
  });
  emitOrderUpdated(tenantId, orderId);
  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, viewerRole);
}
