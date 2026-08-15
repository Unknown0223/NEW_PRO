import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";
import { applyClientBonusDebt } from "./returns-enhanced.bonus-debt";
import { applyClientDiscountDebt } from "./returns-enhanced.discount-debt";
import { autoMarkReturnedOrders } from "./returns-enhanced.auto-mark";

/**
 * Vazvratni zavsklad qabul qiladi (acceptance gate).
 *
 * Yaratishda vazvrat `pending` holatda turadi va HECH QANDAY side-effect
 * qo'llanmaydi. Qabul qilinganda shu yerda:
 *   - ombor ostatkasi (qaytarish ombori) oshiriladi,
 *   - mijoz balansi (refund) qo'llanadi,
 *   - bonus qarzi (agar bo'lsa) qo'llanadi,
 *   - ko'zgu «заявка» holati `delivered` ga o'tadi (yoki to'liq vazvratda manba zakaz `returned`),
 *   - to'liq qaytarilgan manba zakazlar `returned` deb belgilanadi.
 */
export async function acceptSalesReturn(
  tenantId: number,
  returnId: number,
  actorUserId: number | null
): Promise<{ id: number; number: string; status: string }> {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  const ret = await prisma.salesReturn.findFirst({
    where: { tenant_id: tenantId, id: returnId },
    include: { lines: { select: { product_id: true, qty: true } } }
  });
  if (!ret) throw new Error("RETURN_NOT_FOUND");
  if (ret.status === "posted") throw new Error("RETURN_ALREADY_ACCEPTED");
  if (ret.status === "cancelled") throw new Error("RETURN_CANCELLED");
  if (ret.status !== "pending") throw new Error("RETURN_NOT_PENDING");

  const refund =
    ret.refund_amount != null ? new Prisma.Decimal(ret.refund_amount) : new Prisma.Decimal(0);
  const bonusDebt =
    ret.bonus_debt_amount != null
      ? new Prisma.Decimal(ret.bonus_debt_amount)
      : new Prisma.Decimal(0);
  const discountDebt =
    ret.discount_debt_amount != null
      ? new Prisma.Decimal(ret.discount_debt_amount)
      : new Prisma.Decimal(0);

  await prisma.$transaction(async (tx) => {
    // 1) Ombor ostatkasi — qaytarish omboriga qo'shamiz
    for (const ln of ret.lines) {
      const delta = new Prisma.Decimal(ln.qty);
      if (!delta.gt(0)) continue;
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: ret.warehouse_id,
            product_id: ln.product_id
          }
        },
        create: {
          tenant_id: tenantId,
          warehouse_id: ret.warehouse_id,
          product_id: ln.product_id,
          qty: delta
        },
        update: { qty: { increment: delta } }
      });
    }

    // 2) Mijoz balansi (refund)
    if (refund.gt(0) && ret.client_id != null) {
      const bal = await tx.clientBalance.upsert({
        where: { tenant_id_client_id: { tenant_id: tenantId, client_id: ret.client_id } },
        create: { tenant_id: tenantId, client_id: ret.client_id, balance: refund },
        update: { balance: { increment: refund } }
      });
      await tx.clientBalanceMovement.create({
        data: { client_balance_id: bal.id, delta: refund, note: `Vazvrat: ${ret.number}`, user_id: uid }
      });
    }

    // 3) Bonus qarzi
    if (bonusDebt.gt(0) && ret.client_id != null) {
      await applyClientBonusDebt(tx, tenantId, ret.client_id, bonusDebt, uid, {
        returnNumber: ret.number
      });
    }

    // 3b) Skidka qarzi (min_sum buzilishi — qolgan tovar uchun)
    if (discountDebt.gt(0) && ret.client_id != null) {
      await applyClientDiscountDebt(tx, tenantId, ret.client_id, discountDebt, uid, {
        returnNumber: ret.number,
        orderId: ret.order_id,
        note: ret.discount_debt_note,
        newDiscountSum: ret.discount_sum_after
      });
    } else if (ret.order_id != null && ret.discount_sum_after != null) {
      // Proporsional: balans qarzi yo‘q, faqat zakaz discount_sum yangilanadi
      const nd = new Prisma.Decimal(ret.discount_sum_after);
      await tx.order.update({
        where: { id: ret.order_id },
        data: { discount_sum: nd.gt(0) ? nd : new Prisma.Decimal(0) }
      });
    }

    // 4) Hujjat holati — qabul qilingan
    await tx.salesReturn.update({
      where: { id: ret.id },
      data: { status: "posted", accepted_at: new Date(), accepted_by_user_id: uid }
    });

    // 5) Ko'zgu «заявка» yoki manba zakaz holati
    if (ret.mirror_order_id != null) {
      const mirror = await tx.order.findFirst({
        where: { id: ret.mirror_order_id, tenant_id: tenantId },
        select: { id: true, status: true, order_type: true }
      });
      if (mirror && canTransitionOrderStatus(mirror.status, "delivered", normalizeOrderType(mirror.order_type))) {
        await tx.order.update({ where: { id: mirror.id }, data: { status: "delivered" } });
        await tx.orderStatusLog.create({
          data: { order_id: mirror.id, from_status: mirror.status, to_status: "delivered", user_id: uid }
        });
      }
    } else if (ret.return_type === "order_full" && ret.order_id != null) {
      // To'liq vazvrat — manba zakazning o'zi `returned` ga o'tadi (yaratishda kechiktirilgan).
      const src = await tx.order.findFirst({
        where: { id: ret.order_id, tenant_id: tenantId },
        select: { id: true, status: true, order_type: true }
      });
      if (src && canTransitionOrderStatus(src.status, "returned", normalizeOrderType(src.order_type))) {
        await tx.order.update({ where: { id: src.id }, data: { status: "returned" } });
        await tx.orderStatusLog.create({
          data: { order_id: src.id, from_status: src.status, to_status: "returned", user_id: uid }
        });
      }
    }
  });

  // 6) To'liq qaytarilgan manba zakazlarni `returned` deb belgilash (faqat posted hisobga olinadi)
  if (ret.client_id != null) {
    await autoMarkReturnedOrders(
      tenantId,
      ret.client_id,
      ret.date_from ? ret.date_from.toISOString() : undefined,
      ret.date_to ? ret.date_to.toISOString() : undefined,
      uid
    );
  }

  if (ret.mirror_order_id != null) emitOrderUpdated(tenantId, ret.mirror_order_id);
  if (ret.order_id != null) emitOrderUpdated(tenantId, ret.order_id);
  void invalidateDashboard(tenantId);
  void invalidateStock(tenantId, ret.warehouse_id);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "sales_return",
    entityId: String(ret.id),
    action: "return.accept",
    payload: {
      return_id: ret.id,
      number: ret.number,
      warehouse_id: ret.warehouse_id,
      refund: refund.toString(),
      bonus_debt: bonusDebt.toString(),
      discount_debt: discountDebt.toString()
    }
  });

  return { id: ret.id, number: ret.number, status: "posted" };
}

/**
 * Vazvratni rad etish — hech qanday side-effect qo'llanmagani uchun faqat
 * holatni `cancelled` qilamiz va ko'zgu «заявка» ni ham bekor qilamiz.
 */
export async function rejectSalesReturn(
  tenantId: number,
  returnId: number,
  actorUserId: number | null,
  reason?: string | null
): Promise<{ id: number; number: string; status: string }> {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  const ret = await prisma.salesReturn.findFirst({
    where: { tenant_id: tenantId, id: returnId },
    select: { id: true, number: true, status: true, mirror_order_id: true }
  });
  if (!ret) throw new Error("RETURN_NOT_FOUND");
  if (ret.status === "posted") throw new Error("RETURN_ALREADY_ACCEPTED");
  if (ret.status === "cancelled") throw new Error("RETURN_CANCELLED");
  if (ret.status !== "pending") throw new Error("RETURN_NOT_PENDING");

  await prisma.$transaction(async (tx) => {
    await tx.salesReturn.update({
      where: { id: ret.id },
      data: {
        status: "cancelled",
        note: reason?.trim() ? reason.trim().slice(0, 1000) : undefined
      }
    });
    if (ret.mirror_order_id != null) {
      const mirror = await tx.order.findFirst({
        where: { id: ret.mirror_order_id, tenant_id: tenantId },
        select: { id: true, status: true }
      });
      if (mirror && mirror.status !== "cancelled") {
        await tx.order.update({ where: { id: mirror.id }, data: { status: "cancelled" } });
        await tx.orderStatusLog.create({
          data: { order_id: mirror.id, from_status: mirror.status, to_status: "cancelled", user_id: uid }
        });
      }
    }
  });

  if (ret.mirror_order_id != null) emitOrderUpdated(tenantId, ret.mirror_order_id);
  void invalidateDashboard(tenantId);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "sales_return",
    entityId: String(ret.id),
    action: "return.reject",
    payload: { return_id: ret.id, number: ret.number, reason: reason?.trim() || null }
  });

  return { id: ret.id, number: ret.number, status: "cancelled" };
}
