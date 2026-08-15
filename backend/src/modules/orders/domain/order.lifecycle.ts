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
import { appendTenantAuditEvent, AuditEntityType } from "../../../lib/tenant-audit";
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
import { startOrderApprovalIfNeeded } from "../order-approval.service";

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

/**
 * Bosqich (milestone) zanjir tartibi — "Дата отгрузки/доставки" kabi sanalar
 * `orderStatusLog` dan shu status bo'yicha birinchi yozuvdan olinadi.
 * Orqaga qaytarishda undan keyingi bosqich loglarini o'chirish uchun ishlatiladi.
 */
const MILESTONE_RANK: Record<string, number> = {
  new: 0,
  confirmed: 1,
  picking: 2,
  delivering: 3,
  delivered: 4,
  returned: 5
};

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

  if (fromStatus === "new" && trimmed === "confirmed") {
    const approvalStatus = (o as { approval_status?: string | null }).approval_status ?? null;
    if (approvalStatus === "rejected") {
      throw new Error("APPROVAL_REJECTED");
    }
    if (approvalStatus === "pending") {
      throw new Error("APPROVAL_PENDING");
    }
    const approval = await startOrderApprovalIfNeeded(tenantId, orderId, o.agent_id);
    if (approval.started) {
      throw new Error("APPROVAL_PENDING");
    }
  }

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

    // Orqaga qaytarishda — yangi statusdan KEYINGI bosqich loglarini soft-supersede.
    // Tarix saqlanadi; enrichment faqat superseded_at IS NULL loglarni oladi.
    if (isBackwardTransition(fromStatus, trimmed, orderType)) {
      const targetRank = MILESTONE_RANK[trimmed];
      if (targetRank != null) {
        const aheadStatuses = Object.entries(MILESTONE_RANK)
          .filter(([, rank]) => rank > targetRank)
          .map(([s]) => s);
        if (aheadStatuses.length > 0) {
          await tx.orderStatusLog.updateMany({
            where: {
              order_id: o.id,
              to_status: { in: aheadStatuses },
              superseded_at: null
            },
            data: { superseded_at: new Date() }
          });
        }
      }
    }

    // ✅ Rezervatsiya mantig'i
    const whId = o.warehouse_id;
    if (whId != null) {
      const items = await tx.orderItem.findMany({
        where: { order_id: o.id },
        select: { product_id: true, qty: true, is_bonus: true, exchange_line_kind: true }
      });
      // Bonus sovg‘alar create da reserved — confirm/cancel/reopen ham ularni hisobga oladi.
      const outboundStockItems = items.filter((i) => {
        if (i.exchange_line_kind === "minus") return false;
        return true;
      });

      if (trimmed === "confirmed" && fromStatus === "new") {
        // Rezlarga chiqarish + haqiqiy qoldiqdan ayirish
        for (const item of outboundStockItems) {
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
        // Bekor qilish faza'ga bog'liq (aks holda reserved manfiyga tushib,
        // "Доступно для продаж" noto'g'ri oshib ketadi):
        //  - "new" dan: qoldiq hali BAND (reserved) — faqat reservni bo'shatamiz.
        //  - confirmed/picking/delivering/delivered dan: tovar allaqachon fizik
        //    chiqarilgan (qty kamaytirilgan, reserved 0) — fizik qty'ni QAYTA TIKLAYMIZ,
        //    reservga tegmaymiz.
        const stockWasConsumed = ["confirmed", "picking", "delivering", "delivered"].includes(
          fromStatus
        );
        for (const item of outboundStockItems) {
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
            update: stockWasConsumed
              ? { qty: { increment: item.qty } }
              : { reserved_qty: { decrement: item.qty } }
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
        for (const item of outboundStockItems) {
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

  const auditAction = trimmed === "cancelled" ? "order.cancel" : "order.status";
  void appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId,
    entityType: AuditEntityType.order,
    entityId: String(orderId),
    action: auditAction,
    payload: {
      order_id: orderId,
      number: o.number,
      from_status: fromStatus,
      to_status: trimmed
    }
  });

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
    where: { order_id: orderId, to_status: milestoneStatus, superseded_at: null },
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
  const trimmed = nextStatus.trim();
  for (const id of ids) {
    try {
      // Agar zakaz allaqachon shu statusda bo'lsa, status o'zgarmaydi (early-return).
      // Bunday holda foydalanuvchi sana/vaqt bergan bo'lsa — o'sha bosqich (milestone)
      // sanasini tahrirlaymiz, masalan "Отгружен" zakazlar uchun "Дата отгрузки" ni guruh bilan.
      const existing = await prisma.order.findFirst({
        where: { id, tenant_id: tenantId },
        select: { status: true }
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }
      if (existing.status === trimmed && occurredAtRaw) {
        await updateOrderMilestoneAt(tenantId, id, trimmed, occurredAtRaw, actorRole);
      } else {
        await updateOrderStatus(tenantId, id, trimmed, actorUserId, actorRole, occurredAtRaw);
      }
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
  actorUserId: number | null,
  conditionsNoteRaw?: string | null
): Promise<BulkOrderConsignmentResult> {
  const { ORDER_LINES_EDITABLE_STATUSES } = await import("./order.lines");
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  const updated: number[] = [];
  const failed: BulkOrderConsignmentResult["failed"] = [];
  const conditionsNote = conditionsNoteRaw?.trim() || null;
  const actorId =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let actorLabel = "система";
  if (actorId != null) {
    const u = await prisma.user.findFirst({
      where: { id: actorId, tenant_id: tenantId },
      select: { name: true, first_name: true, last_name: true, login: true }
    });
    const composed = [u?.last_name, u?.first_name].filter(Boolean).join(" ").trim();
    actorLabel = (composed || u?.name || u?.login || `user#${actorId}`).trim();
  }

  let consignmentDueDate: Date | null = null;
  if (isConsignment && consignmentDueDateRaw?.trim()) {
    const d = new Date(consignmentDueDateRaw.trim());
    if (!Number.isNaN(d.getTime())) consignmentDueDate = d;
  }

  const dueLabel = consignmentDueDate
    ? consignmentDueDate.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })
    : "—";

  for (const id of ids) {
    try {
      const existing = await prisma.order.findFirst({
        where: { id, tenant_id: tenantId },
        select: {
          id: true,
          status: true,
          order_type: true,
          is_consignment: true,
          consignment_due_date: true,
          comment: true
        }
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

      const now = new Date();
      const stamp = now.toLocaleString("ru-RU", {
        timeZone: "Asia/Tashkent",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });

      let nextComment = existing.comment ?? null;
      if (isConsignment) {
        const line = [
          `[Консигнация] ${stamp}`,
          `Кто: ${actorLabel}`,
          `Срок: ${dueLabel}`,
          conditionsNote ? `Условия: ${conditionsNote}` : null
        ]
          .filter(Boolean)
          .join(" | ");
        nextComment = existing.comment?.trim() ? `${existing.comment.trim()}\n${line}` : line;
        if (nextComment.length > 4000) nextComment = nextComment.slice(-4000);
      }

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            is_consignment: isConsignment,
            consignment_due_date: isConsignment ? consignmentDueDate : null,
            consignment_moved_at: isConsignment ? now : null,
            consignment_moved_by_user_id: isConsignment ? actorId : null,
            ...(nextComment !== existing.comment ? { comment: nextComment } : {})
          }
        });
        await tx.orderChangeLog.create({
          data: {
            order_id: id,
            user_id: actorId,
            action: isConsignment ? "consignment.set" : "consignment.unset",
            payload: {
              from: {
                is_consignment: existing.is_consignment,
                consignment_due_date: existing.consignment_due_date?.toISOString() ?? null
              },
              to: {
                is_consignment: isConsignment,
                consignment_due_date: isConsignment
                  ? (consignmentDueDate?.toISOString() ?? null)
                  : null
              },
              conditions_note: conditionsNote,
              actor_label: actorLabel
            } as Prisma.InputJsonObject
          }
        });
      });
      updated.push(id);
      emitOrderUpdated(tenantId, id);
    } catch (e) {
      failed.push({ id, error: getErrorCode(e) ?? "UNKNOWN" });
    }
  }
  if (updated.length > 0) {
    await invalidateOrdersListCache(tenantId);
  }
  return { updated, failed };
}
