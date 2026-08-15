/**
 * Domain: Orders — meta patch (ombor, agent, ekspeditor, blok, to‘lov usuli, izoh).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import { invalidateStock } from "../../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../../lib/tenant-audit";
import { normalizeOrderType } from "../order-status";
import { resolveAutoExpeditorUserId } from "../expeditor-auto-assign";
import { ORDER_LINES_EDITABLE_STATUSES } from "./order.lines";
import { assertOrderWarehouseBlockAssignment, enrichOrderDetailRow } from "./order.detail-mappers";
import {
  patchOrderMetaBlockOnly,
  patchOrderMetaCommentOnly,
  patchOrderMetaPaymentMethodOnly
} from "./order.meta.simple-patches";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderMetaInput
} from "./order.types";

export async function updateOrderMeta(
  tenantId: number,
  orderId: number,
  input: UpdateOrderMetaInput,
  viewerRole?: string,
  actorUserId?: number | null
): Promise<OrderDetailRow> {
  const patchWh = input.warehouse_id !== undefined;
  const patchAg = input.agent_id !== undefined;
  const patchEx = input.expeditor_user_id !== undefined;
  const patchComment = input.comment !== undefined;
  const patchPm = input.payment_method_ref !== undefined;
  const patchBl = input.warehouse_block_id !== undefined;
  if (!patchWh && !patchAg && !patchEx && !patchComment && !patchPm && !patchBl) {
    throw new Error("EMPTY_META_PATCH");
  }

  const existing = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    include: {
      client: {
        select: {
          category: true,
          sales_channel: true,
          product_category_ref: true,
          region: true,
          city: true,
          district: true,
          zone: true,
          neighborhood: true,
          address: true
        }
      }
    }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const commentOnly = patchComment && !patchWh && !patchAg && !patchEx && !patchPm && !patchBl;
  const paymentMethodOnly = patchPm && !patchWh && !patchAg && !patchEx && !patchComment && !patchBl;
  const blockOnly = patchBl && !patchWh && !patchAg && !patchEx && !patchComment && !patchPm;

  if (paymentMethodOnly) {
    return patchOrderMetaPaymentMethodOnly(tenantId, orderId, existing, input, actorUserId, viewerRole);
  }
  if (commentOnly) {
    return patchOrderMetaCommentOnly(tenantId, orderId, existing, input, viewerRole);
  }
  if (blockOnly) {
    return patchOrderMetaBlockOnly(tenantId, orderId, existing, input, actorUserId, viewerRole);
  }

  if (!ORDER_LINES_EDITABLE_STATUSES.has(existing.status)) {
    throw new Error("ORDER_NOT_EDITABLE");
  }

  const nextWarehouseId = patchWh ? input.warehouse_id! : existing.warehouse_id;
  const nextAgentId = patchAg ? input.agent_id! : existing.agent_id;
  const whChanged = nextWarehouseId !== existing.warehouse_id;
  const agChanged = nextAgentId !== existing.agent_id;

  const existingOtMeta = normalizeOrderType(existing.order_type ?? "order");
  const nextPaymentMethodRef = patchPm
    ? input.payment_method_ref === null
      ? null
      : (input.payment_method_ref ?? "").trim().slice(0, 64) || null
    : ((existing as { payment_method_ref?: string | null }).payment_method_ref ?? null);
  const pmChanged =
    patchPm && String(nextPaymentMethodRef ?? "") !== String((existing as { payment_method_ref?: string | null }).payment_method_ref ?? "");

  if (existingOtMeta === "order") {
    if (nextWarehouseId == null || nextWarehouseId < 1) {
      throw new Error("ORDER_REQUIRES_WAREHOUSE");
    }
    if (nextAgentId == null || nextAgentId < 1) {
      throw new Error("ORDER_REQUIRES_AGENT");
    }
  }

  let commentNext: string | null | undefined;
  if (patchComment) {
    commentNext = input.comment === null ? null : (input.comment ?? "").trim() || null;
  }
  const commentChanged =
    commentNext !== undefined && commentNext !== ((existing as { comment?: string | null }).comment ?? null);

  const logUserId =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  if (nextWarehouseId != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: nextWarehouseId, tenant_id: tenantId }
    });
    if (!wh) {
      throw new Error("BAD_WAREHOUSE");
    }
  }

  if (nextAgentId != null) {
    const u = await prisma.user.findFirst({
      where: { id: nextAgentId, tenant_id: tenantId, is_active: true },
      select: { id: true, branch: true, role: true }
    });
    if (!u) {
      throw new Error("BAD_AGENT");
    }
    if (patchAg && agChanged) {
      const { assertOrderAgentAllowedForClient } = await import("../../work-slots/work-slots.lock");
      await assertOrderAgentAllowedForClient(tenantId, existing.client_id, nextAgentId);
      let viewerBranch: string | null = null;
      if (actorUserId != null && actorUserId > 0) {
        const vu = await prisma.user.findFirst({
          where: { id: actorUserId, tenant_id: tenantId },
          select: { branch: true }
        });
        viewerBranch = vu?.branch ?? null;
      }
      const { assertFieldStaffBranchScope } = await import("../../work-slots/work-slots.branch-scope");
      assertFieldStaffBranchScope(viewerRole, viewerBranch, u.branch);
    }
  }

  if (patchEx && input.expeditor_user_id != null) {
    const ex = await prisma.user.findFirst({
      where: {
        id: input.expeditor_user_id,
        tenant_id: tenantId,
        role: "expeditor",
        is_active: true
      }
    });
    if (!ex) {
      throw new Error("BAD_EXPEDITOR");
    }
  }

  const prevBlockId = (existing as { warehouse_block_id?: number | null }).warehouse_block_id ?? null;
  let nextBlockId = prevBlockId;
  if (whChanged) {
    nextBlockId = null;
  } else if (patchBl) {
    nextBlockId = input.warehouse_block_id ?? null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    let expeditorResolved: number | null;
    if (patchEx) {
      expeditorResolved = input.expeditor_user_id!;
    } else if (whChanged || agChanged) {
      expeditorResolved = await resolveAutoExpeditorUserId(tx, tenantId, {
        client: {
          category: existing.client.category,
          sales_channel: existing.client.sales_channel,
          product_category_ref: existing.client.product_category_ref,
          region: existing.client.region,
          city: existing.client.city,
          district: existing.client.district,
          zone: existing.client.zone,
          neighborhood: existing.client.neighborhood,
          address: existing.client.address
        },
        orderAgentId: nextAgentId,
        warehouseId: nextWarehouseId,
        orderPriceTypes: ["retail"],
        at: new Date()
      });
    } else {
      expeditorResolved = existing.expeditor_user_id;
    }

    await assertOrderWarehouseBlockAssignment(
      tenantId,
      nextWarehouseId,
      expeditorResolved,
      nextBlockId
    );

    const exChanged = expeditorResolved !== existing.expeditor_user_id;
    const blockChanged = nextBlockId !== prevBlockId;
    if (!whChanged && !agChanged && !exChanged && !commentChanged && !pmChanged && !blockChanged) {
      return tx.order.findFirstOrThrow({
        where: { id: orderId, tenant_id: tenantId },
        include: orderDetailInclude
      });
    }

    const metaPayload = {
      ...(whChanged
        ? { warehouse_id: { from: existing.warehouse_id, to: nextWarehouseId } }
        : {}),
      ...(agChanged ? { agent_id: { from: existing.agent_id, to: nextAgentId } } : {}),
      ...(exChanged
        ? {
            expeditor_user_id: {
              from: existing.expeditor_user_id,
              to: expeditorResolved
            }
          }
        : {}),
      ...(commentChanged
        ? {
            comment: {
              from: (existing as { comment?: string | null }).comment ?? null,
              to: commentNext ?? null
            }
          }
        : {}),
      ...(pmChanged
        ? {
            payment_method_ref: {
              from: (existing as { payment_method_ref?: string | null }).payment_method_ref ?? null,
              to: nextPaymentMethodRef
            }
          }
        : {}),
      ...(blockChanged
        ? {
            warehouse_block_id: { from: prevBlockId, to: nextBlockId }
          }
        : {})
    } as Prisma.InputJsonObject;

    await tx.order.update({
      where: { id: orderId },
      data: {
        warehouse_id: nextWarehouseId,
        agent_id: nextAgentId,
        expeditor_user_id: expeditorResolved,
        warehouse_block_id: nextBlockId,
        ...(commentNext !== undefined ? { comment: commentNext } : {}),
        ...(patchPm ? { payment_method_ref: nextPaymentMethodRef } : {})
      }
    });

    if (Object.keys(metaPayload).length > 0) {
      await tx.orderChangeLog.create({
        data: {
          order_id: orderId,
          user_id: logUserId,
          action: "meta",
          payload: metaPayload
        }
      });
    }

    return tx.order.findFirstOrThrow({
      where: { id: orderId, tenant_id: tenantId },
      include: orderDetailInclude
    });
  });

  emitOrderUpdated(tenantId, orderId);
  if (whChanged) {
    if (existing.warehouse_id != null) {
      void invalidateStock(tenantId, existing.warehouse_id);
    }
    if (nextWarehouseId != null) {
      void invalidateStock(tenantId, nextWarehouseId);
    }
  }

  void appendTenantAuditEvent({
    tenantId,
    actorUserId: logUserId,
    entityType: AuditEntityType.order,
    entityId: String(orderId),
    action: "order.meta",
    payload: { order_id: orderId }
  });

  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, viewerRole);
}
