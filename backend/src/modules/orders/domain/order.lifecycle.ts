/**
 * Domain: Orders (yaratish, holat, qoldiq, bonus, ro‘yxat).
 * Boundary: route → JWT/RBAC + Zod; servis → tranzaksiya, zaxira, dashboard/stock invalidatsiya.
 * Bog‘liq: `orders.route.ts`, `contracts/orders.schemas.ts`, `docs/domain-boundary.md`.
 */
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getErrorCode } from "../../../lib/app-error";
import { prisma } from "../../../config/database";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import {
  invalidateDashboard,
  invalidateOrdersListCache,
  invalidateStock
} from "../../../lib/redis-cache";
import { enqueueOrderStatusNotifyJob } from "../../jobs/jobs.service";
import { getProductPrice } from "../../products/product-prices.service";
import { parseBonusStackPolicy } from "../bonus-stack-policy";
import {
  fetchClientUsedAutoBonusRuleIds,
  fetchClientUsedAutoBonusRuleIdsExcludingOrder,
  resolveOrderBonusesForCreate,
  type OrderAgentBonusContext
} from "../order-bonus-apply";
import {
  ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE,
  statusContributesToDeliveredReceivableDebt,
  normalizeOrderType,
  canTransitionOrderStatus,
  getAllowedNextStatuses,
  isBackwardTransition,
  isOperatorLateStageCancelForbidden,
  isValidOrderStatus,
  mayActorRevertOneStep
} from "../order-status";
import { resolveAutoExpeditorUserId } from "../expeditor-auto-assign";
import {
  computeAgentConsignmentOutstanding,
  parseYearMonth,
  utcMonthStart
} from "../../consignment/consignment.service";
import {
  buildNakladnoyXlsx,
  type NakladnoyBuildOptions,
  type NakladnoyLine,
  type NakladnoyOrderPayload,
  DEFAULT_NAKLADNOY_BUILD_OPTIONS
} from "../order-nakladnoy-xlsx";
import { buildNakladnoyPdf } from "../order-nakladnoy-pdf";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../../tenant-settings/tenant-settings.service";
import { prepareExchangeOrderLines } from "../exchange-order-create";

import { updateOrderMeta } from "./order.meta";
import {
  enrichOrderDetailRow
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow
} from "./order.types";

function parseOccurredAt(raw: string | undefined): Date | undefined {
  if (raw == null || !String(raw).trim()) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error("INVALID_OCCURRED_AT");
  }
  return d;
}

export async function updateOrderStatus(
  tenantId: number,
  orderId: number,
  nextStatus: string,
  actorUserId: number | null,
  actorRole: string,
  occurredAtRaw?: string
): Promise<OrderDetailRow> {
  const trimmed = nextStatus.trim();
  if (!isValidOrderStatus(trimmed)) {
    throw new Error("INVALID_STATUS");
  }

  const o = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    include: orderDetailInclude
  });
  if (!o) {
    throw new Error("NOT_FOUND");
  }

  if (o.status === trimmed) {
    return enrichOrderDetailRow(tenantId, o as unknown as OrderDetailLoaded, actorRole);
  }

  const orderType = normalizeOrderType(o.order_type);

  if (!canTransitionOrderStatus(o.status, trimmed, orderType)) {
    const err = new Error("INVALID_TRANSITION") as Error & { from: string; to: string };
    err.from = o.status;
    err.to = trimmed;
    throw err;
  }

  if (isBackwardTransition(o.status, trimmed, orderType) && !mayActorRevertOneStep(actorRole)) {
    throw new Error("FORBIDDEN_REVERT");
  }

  if (actorRole === "operator" && isOperatorLateStageCancelForbidden(o.status, trimmed)) {
    throw new Error("FORBIDDEN_OPERATOR_CANCEL_LATE");
  }

  const fromStatus = o.status;
  const occurredAt = parseOccurredAt(occurredAtRaw);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: o.id },
      data: { status: trimmed }
    });
    await tx.orderStatusLog.create({
      data: {
        order_id: o.id,
        from_status: fromStatus,
        to_status: trimmed,
        user_id:
          actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null,
        created_at: occurredAt ?? new Date()
      }
    });

    // ✅ Rezervatsiya mantig'i
    const whId = o.warehouse_id;
    if (whId != null) {
      const items = await tx.orderItem.findMany({
        where: { order_id: o.id },
        select: { product_id: true, qty: true, is_bonus: true, exchange_line_kind: true }
      });
      const nonBonusItems = items.filter((i) => {
        if (i.is_bonus) return false;
        if (i.exchange_line_kind === "minus") return false;
        return true;
      });

      if (trimmed === "confirmed" && fromStatus === "new") {
        // Rezlarga chiqarish + haqiqiy qoldiqdan ayirish
        for (const item of nonBonusItems) {
          await tx.stock.upsert({
            where: {
              tenant_id_warehouse_id_product_id: {
                tenant_id: tenantId,
                warehouse_id: whId,
                product_id: item.product_id
              }
            },
            create: {
              tenant_id: tenantId,
              warehouse_id: whId,
              product_id: item.product_id,
              qty: new Prisma.Decimal(0),
              reserved_qty: new Prisma.Decimal(0)
            },
            update: {
              qty: { decrement: item.qty },
              reserved_qty: { decrement: item.qty }
            }
          });
        }
      } else if (trimmed === "cancelled") {
        // Rezervni bekor qilish (faqat plus); minus uchun inbound qaytarish
        for (const item of nonBonusItems) {
          await tx.stock.upsert({
            where: {
              tenant_id_warehouse_id_product_id: {
                tenant_id: tenantId,
                warehouse_id: whId,
                product_id: item.product_id
              }
            },
            create: {
              tenant_id: tenantId,
              warehouse_id: whId,
              product_id: item.product_id,
              qty: new Prisma.Decimal(0),
              reserved_qty: new Prisma.Decimal(0)
            },
            update: {
              reserved_qty: { decrement: item.qty }
            }
          });
        }
        const minusItems = items.filter((i) => !i.is_bonus && i.exchange_line_kind === "minus");
        for (const item of minusItems) {
          await tx.stock.upsert({
            where: {
              tenant_id_warehouse_id_product_id: {
                tenant_id: tenantId,
                warehouse_id: whId,
                product_id: item.product_id
              }
            },
            create: {
              tenant_id: tenantId,
              warehouse_id: whId,
              product_id: item.product_id,
              qty: new Prisma.Decimal(0),
              reserved_qty: new Prisma.Decimal(0)
            },
            update: {
              qty: { decrement: item.qty }
            }
          });
        }
      } else if (fromStatus === "cancelled" && trimmed === "new") {
        // Qayta tiklash: rezervni qo'shish
        for (const item of nonBonusItems) {
          await tx.stock.upsert({
            where: {
              tenant_id_warehouse_id_product_id: {
                tenant_id: tenantId,
                warehouse_id: whId,
                product_id: item.product_id
              }
            },
            create: {
              tenant_id: tenantId,
              warehouse_id: whId,
              product_id: item.product_id,
              qty: new Prisma.Decimal(0),
              reserved_qty: item.qty
            },
            update: {
              reserved_qty: { increment: item.qty }
            }
          });
        }
        const minusItemsReopen = items.filter((i) => !i.is_bonus && i.exchange_line_kind === "minus");
        for (const item of minusItemsReopen) {
          await tx.stock.upsert({
            where: {
              tenant_id_warehouse_id_product_id: {
                tenant_id: tenantId,
                warehouse_id: whId,
                product_id: item.product_id
              }
            },
            create: {
              tenant_id: tenantId,
              warehouse_id: whId,
              product_id: item.product_id,
              qty: item.qty,
              reserved_qty: new Prisma.Decimal(0)
            },
            update: {
              qty: { increment: item.qty }
            }
          });
        }
      }
    }

    return tx.order.findFirstOrThrow({
      where: { id: o.id, tenant_id: tenantId },
      include: orderDetailInclude
    });
  });

  emitOrderUpdated(tenantId, orderId);
  void invalidateOrdersListCache(tenantId);
  void invalidateDashboard(tenantId);
  void enqueueOrderStatusNotifyJob({
    tenant_id: tenantId,
    order_id: orderId,
    order_number: o.number,
    client_name: o.client.name,
    from_status: fromStatus,
    to_status: trimmed,
    actor_user_id: actorUserId,
    agent_id: o.agent_id,
    expeditor_user_id: o.expeditor_user_id
  });
  if (o.warehouse_id != null) {
    void invalidateStock(tenantId, o.warehouse_id);
  }
  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, actorRole);
}

/** Mavjud holat logidagi birinchi `to_status` vaqtini tuzatish (masalan ожидаемая отгрузка). */
export async function updateOrderMilestoneAt(
  tenantId: number,
  orderId: number,
  milestone: string,
  occurredAtRaw: string,
  actorRole: string
): Promise<OrderDetailRow> {
  const milestoneStatus = milestone.trim();
  if (!isValidOrderStatus(milestoneStatus)) {
    throw new Error("INVALID_STATUS");
  }
  const occurredAt = parseOccurredAt(occurredAtRaw);
  if (!occurredAt) {
    throw new Error("INVALID_OCCURRED_AT");
  }

  const o = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    include: orderDetailInclude
  });
  if (!o) {
    throw new Error("NOT_FOUND");
  }

  const log = await prisma.orderStatusLog.findFirst({
    where: { order_id: orderId, to_status: milestoneStatus },
    orderBy: { created_at: "asc" },
    select: { id: true }
  });
  if (!log) {
    throw new Error("MILESTONE_NOT_FOUND");
  }

  await prisma.orderStatusLog.update({
    where: { id: log.id },
    data: { created_at: occurredAt }
  });

  emitOrderUpdated(tenantId, orderId);
  void invalidateOrdersListCache(tenantId);
  void invalidateDashboard(tenantId);

  const refreshed = await prisma.order.findFirstOrThrow({
    where: { id: orderId, tenant_id: tenantId },
    include: orderDetailInclude
  });
  return enrichOrderDetailRow(tenantId, refreshed as unknown as OrderDetailLoaded, actorRole);
}

export type BulkOrderStatusResult = {
  updated: number[];
  failed: { id: number; error: string; from?: string; to?: string }[];
};

/** Bir nechta zakaz uchun ketma-ket `updateOrderStatus` (har biri o‘z logi / socket bilan). */
export async function bulkUpdateOrderStatus(
  tenantId: number,
  orderIds: number[],
  nextStatus: string,
  actorUserId: number | null,
  actorRole: string,
  occurredAtRaw?: string
): Promise<BulkOrderStatusResult> {
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  const updated: number[] = [];
  const failed: BulkOrderStatusResult["failed"] = [];
  for (const id of ids) {
    try {
      await updateOrderStatus(tenantId, id, nextStatus, actorUserId, actorRole, occurredAtRaw);
      updated.push(id);
    } catch (e) {
      const code = getErrorCode(e) ?? "UNKNOWN";
      const ex = e as Error & { from?: string; to?: string };
      failed.push({
        id,
        error: code,
        ...(code === "INVALID_TRANSITION" ? { from: ex.from, to: ex.to } : {})
      });
    }
  }
  return { updated, failed };
}

export type BulkOrderExpeditorResult = {
  updated: number[];
  failed: { id: number; error: string }[];
};

/** Guruh: ekspeditor biriktirish / yechish (`null` — yechish). Har biri `updateOrderMeta` qoidalariga bo‘ysunadi. */
export async function bulkUpdateOrderExpeditor(
  tenantId: number,
  orderIds: number[],
  expeditorUserId: number | null,
  actorUserId: number | null,
  viewerRole?: string
): Promise<BulkOrderExpeditorResult> {
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  const updated: number[] = [];
  const failed: BulkOrderExpeditorResult["failed"] = [];
  for (const id of ids) {
    try {
      await updateOrderMeta(
        tenantId,
        id,
        { expeditor_user_id: expeditorUserId },
        viewerRole,
        actorUserId
      );
      updated.push(id);
    } catch (e) {
      failed.push({ id, error: getErrorCode(e) ?? "UNKNOWN" });
    }
  }
  return { updated, failed };
}

export type BulkOrderConsignmentResult = {
  updated: number[];
  failed: { id: number; error: string }[];
};

/** Guruh: konsignatsiya belgisi va (ixtiyoriy) muddat. Faqat `new` / `confirmed` zakazlar. */
export async function bulkUpdateOrderConsignment(
  tenantId: number,
  orderIds: number[],
  isConsignment: boolean,
  consignmentDueDateRaw: string | null | undefined,
  _actorUserId: number | null
): Promise<BulkOrderConsignmentResult> {
  const { ORDER_LINES_EDITABLE_STATUSES } = await import("./order.lines");
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  const updated: number[] = [];
  const failed: BulkOrderConsignmentResult["failed"] = [];

  let consignmentDueDate: Date | null = null;
  if (isConsignment && consignmentDueDateRaw?.trim()) {
    const d = new Date(consignmentDueDateRaw.trim());
    if (!Number.isNaN(d.getTime())) consignmentDueDate = d;
  }

  for (const id of ids) {
    try {
      const existing = await prisma.order.findFirst({
        where: { id, tenant_id: tenantId },
        select: { id: true, status: true, order_type: true }
      });
      if (!existing) {
        failed.push({ id, error: "NOT_FOUND" });
        continue;
      }
      if (!ORDER_LINES_EDITABLE_STATUSES.has(existing.status)) {
        failed.push({ id, error: "ORDER_NOT_EDITABLE" });
        continue;
      }
      const ot = (existing.order_type ?? "order").trim();
      if (ot !== "order") {
        failed.push({ id, error: "BAD_ORDER_TYPE" });
        continue;
      }
      await prisma.order.update({
        where: { id },
        data: {
          is_consignment: isConsignment,
          consignment_due_date: isConsignment ? consignmentDueDate : null
        }
      });
      updated.push(id);
    } catch (e) {
      failed.push({ id, error: getErrorCode(e) ?? "UNKNOWN" });
    }
  }
  return { updated, failed };
}
