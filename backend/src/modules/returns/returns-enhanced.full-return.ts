import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";

import type { FullReturnInput, PeriodReturnResult } from "./returns-enhanced.types";
// FullReturnInput in types; PeriodReturnResult for return shape
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";

export async function createFullReturnFromOrder(
  tenantId: number, input: FullReturnInput,
  actorUserId: number | null
): Promise<PeriodReturnResult> {
  const order = await prisma.order.findFirst({
    where: { id: input.order_id, tenant_id: tenantId },
    include: {
      items: { include: { product: { select: { sku: true, name: true } } } },
      client: { select: { id: true } }
    }
  });
  if (!order) throw new Error("BAD_ORDER");
  if (order.status === "cancelled" || order.status === "returned") {
    throw new Error("ORDER_NOT_RETURNABLE");
  }

  const existingFull = await prisma.salesReturn.findFirst({
    where: {
      tenant_id: tenantId,
      order_id: order.id,
      status: { in: ["pending", "posted"] },
      return_type: "order_full"
    },
    select: { id: true }
  });
  if (existingFull) throw new Error("ORDER_ALREADY_FULLY_RETURNED");

  const priorPosted = await prisma.salesReturn.findMany({
    where: { tenant_id: tenantId, order_id: order.id, status: { in: ["pending", "posted"] } },
    select: { lines: { select: { product_id: true, qty: true } } }
  });
  const returnedByProduct = new Map<number, number>();
  for (const r of priorPosted) {
    for (const ln of r.lines) {
      returnedByProduct.set(
        ln.product_id,
        (returnedByProduct.get(ln.product_id) ?? 0) + Number(ln.qty)
      );
    }
  }
  const orderedByProduct = new Map<number, number>();
  for (const it of order.items) {
    orderedByProduct.set(
      it.product_id,
      (orderedByProduct.get(it.product_id) ?? 0) + Number(it.qty)
    );
  }
  const alreadyFullyReturned = [...orderedByProduct.keys()].every((pid) => {
    const need = orderedByProduct.get(pid) ?? 0;
    const have = returnedByProduct.get(pid) ?? 0;
    return have >= need;
  });
  if (alreadyFullyReturned) throw new Error("ORDER_ALREADY_FULLY_RETURNED");

  const fullReturnProductIds = [...new Set(order.items.map((it) => it.product_id))];
  await assertReturnProductsInterchangeableStrict(
    tenantId,
    fullReturnProductIds,
    effectiveReturnPriceType(input.price_type)
  );

  const warehouseId = input.warehouse_id ?? await findReturnWarehouse(tenantId);
  const number = `VR-${tenantId}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const uid = actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const refund =
    input.refund_amount != null ? R(input.refund_amount) : R(order.total_sum);

  const bonusQtySum = order.items
    .filter((i) => i.is_bonus)
    .reduce((a, i) => a + Number(i.qty), 0);
  const paidQtySum = order.items
    .filter((i) => !i.is_bonus)
    .reduce((a, i) => a + Number(i.qty), 0);
  const totalQty = order.items.reduce((a, i) => a + Number(i.qty), 0);

  const created = await prisma.$transaction(async (tx) => {
    const ret = await tx.salesReturn.create({
      data: {
        tenant_id: tenantId, number,
        client_id: order.client_id, order_id: order.id,
        warehouse_id: warehouseId, status: "pending",
        refund_amount: refund,
        return_type: "order_full",
        note: input.note?.trim() || null,
        refusal_reason_ref:
          input.refusal_reason_ref != null && String(input.refusal_reason_ref).trim()
            ? String(input.refusal_reason_ref).trim().slice(0, 128)
            : null,
        created_by_user_id: uid,
        lines: {
          create: order.items.map(it => ({
            product_id: it.product_id, qty: it.qty,
            paid_qty: it.is_bonus ? new Prisma.Decimal(0) : it.qty,
            bonus_qty: it.is_bonus ? it.qty : new Prisma.Decimal(0)
          }))
        }
      }
    });

    // Side-effect'lar (ostatka / manba zakaz `returned` / balans) zavsklad
    // qabulida qo'llanadi — bu yerda faqat `pending` hujjat yaratiladi.
    return ret;
  });

  await appendTenantAuditEvent({
    tenantId, actorUserId, entityType: AuditEntityType.stock,
    entityId: String(created.id),
    action: "full_return",
    payload: { return_id: created.id, number: created.number, order_id: order.id }
  });

  return {
    id: created.id,
    number: created.number,
    refund_amount: created.refund_amount?.toString() ?? refund.toString(),
    lines: order.items.map(it => ({
      product_id: it.product_id,
      sku: it.product.sku, name: it.product.name,
      qty: it.qty.toString(),
      paid_qty: it.is_bonus ? "0" : it.qty.toString(),
      bonus_qty: it.is_bonus ? it.qty.toString() : "0",
      paid_amount: it.is_bonus ? "0" : it.total.toString()
    })),
    bonus_recalc: {
      original_bonus_qty: bonusQtySum,
      remaining_bonus_qty: 0,
      excess_bonus: bonusQtySum,
      total_return_qty: totalQty,
      paid_return_qty: paidQtySum,
      bonus_return_qty: bonusQtySum,
      refund_amount: refund.toString()
    }
  };
}
