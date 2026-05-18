import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

/**
 * «Заявки» ro‘yxati `orders` dan — polki faqat `sales_return` bo‘lgani uchun
 * shu yerga ko‘zgu yozuv: bir xil raqam (VR-…), `order_type` + filtrlash.
 * `status: returned` — kredit yig‘indisiga kirmaydi (ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE).
 */
export async function createPolkiMirrorZayavka(
  tx: Tx,
  params: {
    tenantId: number;
    number: string;
    clientId: number;
    warehouseId: number;
    orderType: "return" | "return_by_order";
    retLines: Array<{
      product_id: number;
      qty: number;
      paid_qty: number;
      bonus_qty: number;
      price: number;
    }>;
    refundAmount: Prisma.Decimal;
    note: string | null;
    refusalReasonRef: string | null;
    /** Po zakaz — manba zakaz raqami (izoh) */
    sourceOrderNumber?: string | null;
  }
): Promise<number> {
  const creates: Prisma.OrderItemCreateWithoutOrderInput[] = [];

  for (const rl of params.retLines) {
    const priceDec = R(rl.price);
    if (rl.paid_qty > 0) {
      const q = new Prisma.Decimal(rl.paid_qty);
      creates.push({
        product: { connect: { id: rl.product_id } },
        qty: q,
        price: priceDec,
        total: R(priceDec.mul(rl.paid_qty)),
        is_bonus: false
      });
    }
    if (rl.bonus_qty > 0) {
      const q = new Prisma.Decimal(rl.bonus_qty);
      creates.push({
        product: { connect: { id: rl.product_id } },
        qty: q,
        price: priceDec,
        total: R(priceDec.mul(rl.bonus_qty)),
        is_bonus: true
      });
    }
    if (rl.paid_qty <= 0 && rl.bonus_qty <= 0 && rl.qty > 0) {
      const q = new Prisma.Decimal(rl.qty);
      creates.push({
        product: { connect: { id: rl.product_id } },
        qty: q,
        price: priceDec,
        total: R(priceDec.mul(rl.qty)),
        is_bonus: false
      });
    }
  }

  const bonusSum = params.retLines.reduce(
    (a, l) => a.add(R(l.price).mul(l.bonus_qty)),
    new Prisma.Decimal(0)
  );

  let comment = params.note?.trim() || null;
  if (params.refusalReasonRef?.trim()) {
    const r = params.refusalReasonRef.trim().slice(0, 200);
    comment = comment ? `${comment}\n[Отказ: ${r}]` : `[Отказ: ${r}]`;
  }
  if (params.sourceOrderNumber?.trim()) {
    const tag = `По заказу ${params.sourceOrderNumber.trim()}`;
    comment = comment ? `${comment}\n${tag}` : tag;
  }

  const created = await tx.order.create({
    data: {
      tenant_id: params.tenantId,
      number: params.number,
      client_id: params.clientId,
      warehouse_id: params.warehouseId,
      order_type: params.orderType,
      status: "returned",
      total_sum: params.refundAmount,
      bonus_sum: bonusSum,
      discount_sum: new Prisma.Decimal(0),
      comment,
      ...(creates.length > 0 ? { items: { create: creates } } : {})
    }
  });
  return created.id;
}
