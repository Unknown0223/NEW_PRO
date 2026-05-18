import { Prisma } from "@prisma/client";
import { resolveAutoExpeditorUserId } from "../expeditor-auto-assign";
import { bonusGiftMapToJson } from "./order.detail-mappers";
import { orderDetailInclude } from "./order.types";
import type { CreateOrderLimitsResult } from "./order.create-tx.limits";
import type { CreateOrderPaidBundle } from "./order.create-tx.bonus";
import type { CreateOrderTxParams } from "./order.create-tx.types";

export async function persistCreateOrderInTransaction(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paid: CreateOrderPaidBundle,
  limits: CreateOrderLimitsResult
) {
  const { tenantId, input, client, orderType, priceType, exchangeMetaJson, validatedGiftOverrides, tempOrderNumber, isInboundShelfReturn } =
    p;
  const { paidAfterDisc, paidTotal, bonusCreates, bonusSum, discountSum, appliedAutoBonusRuleIds } = paid;
  const { isConsignmentOrder, consignmentDueDate } = limits;
  const whId = input.warehouse_id;

  let expeditorUserId: number | null;
  if (input.expeditor_user_id !== undefined && input.expeditor_user_id !== null) {
    const ex = await tx.user.findFirst({
      where: {
        id: input.expeditor_user_id,
        tenant_id: tenantId,
        role: "expeditor",
        is_active: true
      },
      select: { id: true }
    });
    if (!ex) {
      throw new Error("BAD_EXPEDITOR");
    }
    expeditorUserId = ex.id;
  } else if (input.expeditor_user_id === null) {
    expeditorUserId = null;
  } else {
    expeditorUserId = await resolveAutoExpeditorUserId(tx, tenantId, {
      client: {
        category: client.category,
        sales_channel: client.sales_channel,
        product_category_ref: client.product_category_ref,
        region: client.region,
        city: client.city,
        district: client.district,
        zone: client.zone,
        neighborhood: client.neighborhood,
        address: client.address
      },
      orderAgentId: input.agent_id ?? null,
      warehouseId: input.warehouse_id ?? null,
      orderPriceTypes: [priceType],
      at: new Date()
    });
  }

  const commentTrim =
    input.comment === undefined || input.comment === null ? null : input.comment.trim() || null;

  const requestTypeRefTrim =
    input.request_type_ref === undefined || input.request_type_ref === null
      ? null
      : input.request_type_ref.trim().slice(0, 128) || null;

  const statusForType =
    orderType === "order"
      ? "new"
      : orderType === "return" || orderType === "return_by_order"
        ? "returned"
        : "new";

  const created = await tx.order.create({
    data: {
      tenant_id: tenantId,
      number: tempOrderNumber,
      client_id: input.client_id,
      warehouse_id: input.warehouse_id,
      agent_id: input.agent_id ?? null,
      expeditor_user_id: expeditorUserId,
      order_type: orderType,
      status: statusForType,
      total_sum: paidTotal,
      bonus_sum: bonusSum,
      discount_sum: discountSum,
      applied_auto_bonus_rule_ids: appliedAutoBonusRuleIds,
      bonus_gift_selections: bonusGiftMapToJson(new Map(validatedGiftOverrides)),
      comment: commentTrim,
      request_type_ref: requestTypeRefTrim,
      is_consignment: isConsignmentOrder,
      consignment_due_date: isConsignmentOrder ? consignmentDueDate : null,
      payment_method_ref:
        orderType === "order" ? (input.payment_method_ref ?? "").trim().slice(0, 64) || null : null,
      ...(orderType === "exchange" && exchangeMetaJson != null ? { exchange_meta: exchangeMetaJson } : {}),
      items: {
        create: [
          ...paidAfterDisc.map((l) => ({
            product_id: l.product_id,
            qty: l.qty,
            price: l.price,
            total: l.total,
            is_bonus: false,
            exchange_line_kind: l.exchange_line_kind ?? null
          })),
          ...bonusCreates
        ]
      }
    },
    include: orderDetailInclude
  });

  if (isInboundShelfReturn) {
    const inboundByProduct = new Map<number, Prisma.Decimal>();
    const addIn = (productId: number, q: Prisma.Decimal) => {
      const cur = inboundByProduct.get(productId) ?? new Prisma.Decimal(0);
      inboundByProduct.set(productId, cur.add(q));
    };
    for (const l of paidAfterDisc) {
      addIn(l.product_id, l.qty);
    }
    for (const b of bonusCreates) {
      addIn(b.product_id, b.qty);
    }
    for (const [productId, dq] of inboundByProduct) {
      if (!dq.gt(0)) continue;
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: whId,
            product_id: productId
          }
        },
        create: {
          tenant_id: tenantId,
          warehouse_id: whId,
          product_id: productId,
          qty: dq
        },
        update: { qty: { increment: dq } }
      });
    }
  } else if (orderType === "exchange") {
    const inboundByProduct = new Map<number, Prisma.Decimal>();
    const addInEx = (productId: number, q: Prisma.Decimal) => {
      const cur = inboundByProduct.get(productId) ?? new Prisma.Decimal(0);
      inboundByProduct.set(productId, cur.add(q));
    };
    for (const l of paidAfterDisc) {
      if (l.exchange_line_kind === "minus") addInEx(l.product_id, l.qty);
    }
    for (const [productId, dq] of inboundByProduct) {
      if (!dq.gt(0)) continue;
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: whId,
            product_id: productId
          }
        },
        create: {
          tenant_id: tenantId,
          warehouse_id: whId,
          product_id: productId,
          qty: dq
        },
        update: { qty: { increment: dq } }
      });
    }
  }

  return tx.order.update({
    where: { id: created.id },
    data: { number: String(created.id) },
    include: orderDetailInclude
  });
}
