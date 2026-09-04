/**
 * Domain: Orders — zakaz qatorlari (PATCH lines).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../../lib/tenant-audit";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import { invalidateStock } from "../../../lib/redis-cache";
import { getProductPrice } from "../../products/product-prices.service";
import { resolveStoredPaymentMethodRef } from "../../tenant-settings/finance-refs";
import {
  loadPaymentMethodEntriesForResolve,
  loadPriceTypeEntriesForResolve
} from "../../tenant-settings/tenant-settings.service";
import { parseBonusStackPolicy } from "../bonus-stack-policy";
import { buildAppliedBonusRulesSnapshotForOrder } from "../order-bonus-snapshot.persist";
import {
  fetchClientUsedAutoBonusRuleIdsExcludingOrder,
  resolveOrderBonusesForCreate,
  type OrderAgentBonusContext
} from "../order-bonus-apply";
import { capBonusCreatesToStock, mergeOrderAutoComments } from "../order-bonus-stock-cap";
import {
  buildDiscountAlertComment,
  resolveDiscountAlert,
  stripDiscountAlertComments
} from "../order-discount-alert";
import { normalizeOrderType } from "../order-status";
import {
  computeAgentConsignmentOutstanding,
  parseYearMonth,
  utcMonthStart
} from "../../consignment/consignment.service";

import {
  bonusGiftMapToJson,
  enrichOrderDetailRow,
  parseBonusGiftSelectionsJson,
  roundOrderMoney,
  validateBonusGiftOverrides
} from "./order.detail-mappers";
import { assertOrderLinesCreditAndPayments } from "./order.lines-guards";
import { adjustOutboundStockForOrderLinesEdit } from "./order.lines-stock";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderLinesInput
} from "./order.types";

export const ORDER_LINES_EDITABLE_STATUSES = new Set(["new", "confirmed"]);

function sameNullableId(a: number | null | undefined, b: number | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

function samePaymentRef(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").trim() || null;
  const nb = (b ?? "").trim() || null;
  return na === nb;
}

export async function updateOrderLines(
  tenantId: number,
  orderId: number,
  input: UpdateOrderLinesInput,
  viewerRole?: string,
  actorUserId?: number | null
): Promise<OrderDetailRow> {
  if (!input.items.length) {
    throw new Error("EMPTY_ITEMS");
  }

  const existing = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  if (!ORDER_LINES_EDITABLE_STATUSES.has(existing.status)) {
    throw new Error("ORDER_NOT_EDITABLE");
  }

  if (viewerRole === "operator") {
    throw new Error("FORBIDDEN_OPERATOR_ORDER_LINES_EDIT");
  }

  const prevAllItems = await prisma.orderItem.findMany({
    where: { order_id: orderId },
    orderBy: { id: "asc" },
    select: { product_id: true, qty: true, is_bonus: true, exchange_line_kind: true }
  });
  const prevPaidItems = prevAllItems.filter((r) => !r.is_bonus);

  const logUserId =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  const client = await prisma.client.findFirst({
    where: {
      id: existing.client_id,
      tenant_id: tenantId,
      merged_into_client_id: null,
      is_active: true
    }
  });
  if (!client) {
    throw new Error("BAD_CLIENT");
  }

  const priorSelections = parseBonusGiftSelectionsJson(
    (existing as { bonus_gift_selections?: Prisma.JsonValue | null }).bonus_gift_selections ?? null
  );
  const bodyGiftOverrides =
    input.bonus_gift_overrides?.length ?
      await validateBonusGiftOverrides(tenantId, input.bonus_gift_overrides)
    : new Map<number, number>();
  const giftSelectionMap = new Map(priorSelections);
  for (const [k, v] of bodyGiftOverrides) giftSelectionMap.set(k, v);

  // Agent, ombor doim qulflangan. To‘lov usuli — faqat «new» da o‘zgartiriladi.
  if (input.agent_id !== undefined && !sameNullableId(input.agent_id, existing.agent_id)) {
    throw new Error("ORDER_HEADER_LOCKED");
  }

  const isNewStatus = existing.status === "new";
  const existingPm =
    (existing as { payment_method_ref?: string | null }).payment_method_ref?.trim() || null;

  const warehouseId = existing.warehouse_id;
  if (input.warehouse_id !== undefined && !sameNullableId(input.warehouse_id, existing.warehouse_id)) {
    throw new Error("ORDER_HEADER_LOCKED");
  }

  let nextPaymentMethodRef = existingPm;
  if (input.payment_method_ref !== undefined && !samePaymentRef(input.payment_method_ref, existingPm)) {
    if (!isNewStatus) throw new Error("ORDER_HEADER_LOCKED");
    nextPaymentMethodRef =
      input.payment_method_ref === null
        ? null
        : (input.payment_method_ref ?? "").trim().slice(0, 64) || null;
  }

  const agentId = existing.agent_id;
  const priceType = (input.price_type ?? "").trim() || "retail";
  const patchPriceType = (input.price_type ?? "").trim();

  if (isNewStatus && patchPriceType) {
    const [priceTypeEntries, paymentMethodEntries] = await Promise.all([
      loadPriceTypeEntriesForResolve(tenantId),
      loadPaymentMethodEntriesForResolve(tenantId)
    ]);
    const derived = resolveStoredPaymentMethodRef({
      paymentMethodRef: nextPaymentMethodRef,
      priceType: patchPriceType,
      priceTypeEntries,
      paymentMethodEntries,
      preferPriceType: true
    });
    if (derived && !samePaymentRef(derived, nextPaymentMethodRef)) {
      nextPaymentMethodRef = derived;
    } else if (!nextPaymentMethodRef && derived) {
      nextPaymentMethodRef = derived;
    }
  }

  const warehouseChanged = !sameNullableId(warehouseId, existing.warehouse_id);
  const paymentChanged = !samePaymentRef(nextPaymentMethodRef, existingPm);

  const existingOrderType = normalizeOrderType(existing.order_type ?? "order");

  if (existingOrderType === "order") {
    if (warehouseId == null || warehouseId < 1) {
      throw new Error("ORDER_REQUIRES_WAREHOUSE");
    }
    if (agentId == null || agentId < 1) {
      throw new Error("ORDER_REQUIRES_AGENT");
    }
  }

  if (warehouseId != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenant_id: tenantId }
    });
    if (!wh) {
      throw new Error("BAD_WAREHOUSE");
    }
  }

  let orderAgentForBonus: OrderAgentBonusContext | null = null;
  if (agentId != null) {
    const u = await prisma.user.findFirst({
      where: { id: agentId, tenant_id: tenantId, is_active: true },
      select: { id: true, branch: true, trade_direction_id: true }
    });
    if (!u) {
      throw new Error("BAD_AGENT");
    }
    orderAgentForBonus = {
      userId: u.id,
      branch: u.branch,
      trade_direction_id: u.trade_direction_id
    };
  }

  const lineData: Array<{
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
  }> = [];
  let totalSum = new Prisma.Decimal(0);
  const qtyByProduct = new Map<number, number>();
  const productById = new Map<number, { id: number; category_id: number | null }>();
  const orderedProductIds = new Set<number>();

  // ✅ BATCH: bitta so'rov bilan barcha mahsulotlarni olish (N+1 fix)
  const updateProductIds = new Set(input.items.map(i => i.product_id));
  if (updateProductIds.size !== input.items.length) {
    throw new Error("DUPLICATE_PRODUCT");
  }
  for (const it of input.items) {
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new Error("BAD_QTY");
    }
  }
  const ulProductIds = [...updateProductIds];
  const ulProducts = await prisma.product.findMany({
    where: { id: { in: ulProductIds }, tenant_id: tenantId, is_active: true }
  });
  const ulProductMap = new Map(ulProducts.map(p => [p.id, p]));
  for (const it of input.items) {
    const product = ulProductMap.get(it.product_id);
    if (!product) {
      throw new Error("BAD_PRODUCT");
    }
    const priceStr = await getProductPrice(tenantId, it.product_id, priceType);
    if (priceStr == null) {
      const e = new Error("NO_PRICE") as Error & { product_id: number; price_type: string };
      e.product_id = it.product_id;
      e.price_type = priceType;
      throw e;
    }
    const price = new Prisma.Decimal(priceStr);
    const qty = new Prisma.Decimal(it.qty);
    const lineTotal = qty.mul(price);
    totalSum = totalSum.add(lineTotal);
    lineData.push({ product_id: it.product_id, qty, price, total: lineTotal });
    productById.set(product.id, { id: product.id, category_id: product.category_id });
    qtyByProduct.set(it.product_id, (qtyByProduct.get(it.product_id) ?? 0) + it.qty);
    orderedProductIds.add(it.product_id);
  }

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const stackPolicy = parseBonusStackPolicy(tenantRow?.settings);

  const updated = await prisma.$transaction(async (tx) => {
    const applyBonus = input.apply_bonus ?? true;
    const applyDiscount = input.apply_discount !== false;
    let paidAfterDisc = lineData;
    let paidTotal = totalSum;
    let bonusDrafts: Array<{
      product_id: number;
      qty: Prisma.Decimal;
      price: Prisma.Decimal;
      total: Prisma.Decimal;
    }> = [];
    let appliedAutoBonusRuleIds: number[] = [];
    if (applyBonus || applyDiscount) {
      const usedRuleIds = await fetchClientUsedAutoBonusRuleIdsExcludingOrder(
        tx,
        tenantId,
        client.id,
        orderId
      );
      const resolved = await resolveOrderBonusesForCreate(
        tx,
        tenantId,
        { id: client.id, category: client.category },
        lineData,
        totalSum,
        totalSum,
        qtyByProduct,
        productById,
        orderedProductIds,
        stackPolicy,
        usedRuleIds,
        giftSelectionMap,
        new Map<number, ReadonlyMap<number, number>>(),
        warehouseId,
        { referenceAt: existing.created_at, excludeOrderId: orderId },
        orderAgentForBonus,
        { applyDiscount, applyBonusLines: applyBonus, is_consignment: existing.is_consignment === true }
      );
      paidAfterDisc = resolved.lines;
      paidTotal = resolved.total;
      bonusDrafts = applyBonus ? resolved.bonusDrafts : [];
      appliedAutoBonusRuleIds = resolved.appliedAutoBonusRuleIds;
    }

    let bonusSum = new Prisma.Decimal(0);
    let bonusCreates = bonusDrafts.map((b) => {
      bonusSum = bonusSum.add(b.total);
      return {
        product_id: b.product_id,
        qty: b.qty,
        price: b.price,
        total: b.total,
        is_bonus: true as const
      };
    });

    let bonusAlert: string | null = null;
    let linesComment = stripDiscountAlertComments(existing.comment ?? null);
    if (applyBonus && bonusCreates.length > 0 && warehouseId != null) {
      const stockCap = await capBonusCreatesToStock(
        tx,
        tenantId,
        warehouseId,
        paidAfterDisc,
        bonusCreates
      );
      bonusCreates = stockCap.bonusCreates;
      bonusSum = stockCap.bonusSum;
      bonusAlert = stockCap.bonusAlert;
      linesComment = mergeOrderAutoComments(linesComment, [stockCap.shortageComment]);
    }

    const rawDiscUp = totalSum.sub(paidTotal);
    const discountSum =
      applyDiscount && rawDiscUp.gt(0) ? roundOrderMoney(rawDiscUp) : new Prisma.Decimal(0);

    const discountRes = await resolveDiscountAlert(tx, {
      tenantId,
      orderType: existingOrderType,
      applyDiscount,
      warehouseId,
      client: { id: client.id, category: client.category },
      orderAgent: orderAgentForBonus,
      qtyByProduct,
      productById,
      orderedProductIds,
      baseSubtotal: totalSum,
      giftOverrides: giftSelectionMap,
      stackPolicy,
      discountSum,
      appliedAutoBonusRuleIds,
      excludeOrderId: orderId,
      referenceAt: existing.created_at,
      is_consignment: existing.is_consignment === true
    });
    const prevDiscountAlert =
      (existing as { discount_alert?: string | null }).discount_alert ?? null;
    const prevBonusAlert = (existing as { bonus_alert?: string | null }).bonus_alert ?? null;

    let discountAlert = discountRes.alert;
    // Tahrirlashda soxta «not_applied» qo‘ymaymiz (oldingi alert yo‘q va kutilgan skidka ham yo‘q).
    if (
      prevDiscountAlert == null &&
      discountAlert === "not_applied" &&
      (discountRes.expectedSum <= 0 || discountRes.discountPct == null)
    ) {
      discountAlert = null;
    }

    if (discountAlert != null) {
      linesComment = mergeOrderAutoComments(linesComment, [
        buildDiscountAlertComment(discountAlert, {
          discountPct: discountRes.discountPct,
          expectedSum: discountRes.expectedSum,
          orderLabel: `заказ #${existing.number}`
        })
      ]);
    }

    const alertsClearedAt =
      (prevDiscountAlert != null && discountAlert == null) ||
      (prevBonusAlert != null && bonusAlert == null)
        ? new Date().toISOString()
        : null;

    await assertOrderLinesCreditAndPayments(tx, {
      tenantId,
      orderId,
      clientId: client.id,
      creditLimit: client.credit_limit,
      paidTotal
    });

    // Konsignatsiya limiti: tahrirda summa oshganda ham `new` bandligini hisobga olish
    if (
      existing.is_consignment &&
      normalizeOrderType(existing.order_type) === "order" &&
      existing.agent_id != null &&
      existing.agent_id > 0
    ) {
      const ag = await tx.user.findFirst({
        where: { id: existing.agent_id, tenant_id: tenantId, is_active: true },
        select: {
          consignment: true,
          consignment_limit_amount: true,
          consignment_ignore_previous_months_debt: true
        }
      });
      const lim = ag?.consignment_limit_amount;
      if (ag?.consignment && lim != null) {
        const { year, month } = parseYearMonth(undefined);
        const outstanding = await computeAgentConsignmentOutstanding(tx, tenantId, existing.agent_id, {
          ignorePreviousMonthsDebt: ag.consignment_ignore_previous_months_debt === true,
          monthStartsAt: utcMonthStart(year, month),
          excludeOrderId: orderId
        });
        const projected = outstanding.add(paidTotal);
        if (projected.gt(lim)) {
          const err = new Error("CONSIGNMENT_LIMIT_EXCEEDED") as Error & {
            consignment_limit?: string;
            outstanding?: string;
            order_total?: string;
          };
          err.consignment_limit = lim.toString();
          err.outstanding = outstanding.toString();
          err.order_total = paidTotal.toString();
          throw err;
        }
      }
    }

    const nextStockLines = [
      ...paidAfterDisc.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        exchange_line_kind: null as string | null
      })),
      ...bonusCreates.map((b) => ({
        product_id: b.product_id,
        qty: b.qty,
        exchange_line_kind: null as string | null
      }))
    ];
    if (existingOrderType === "order") {
      if (warehouseChanged && existing.warehouse_id != null && warehouseId != null) {
        // Eski ombordagi rezervni yechish, yangi omborda bron qilish.
        await adjustOutboundStockForOrderLinesEdit(tx, {
          tenantId,
          warehouseId: existing.warehouse_id,
          orderStatus: existing.status,
          prevLines: prevAllItems,
          nextLines: []
        });
        await adjustOutboundStockForOrderLinesEdit(tx, {
          tenantId,
          warehouseId,
          orderStatus: existing.status,
          prevLines: [],
          nextLines: nextStockLines
        });
      } else if (warehouseId != null) {
        await adjustOutboundStockForOrderLinesEdit(tx, {
          tenantId,
          warehouseId,
          orderStatus: existing.status,
          prevLines: prevAllItems,
          nextLines: nextStockLines
        });
      }
    }

    await tx.orderItem.deleteMany({ where: { order_id: orderId } });

    const bonusSnapshot =
      appliedAutoBonusRuleIds.length > 0
        ? await buildAppliedBonusRulesSnapshotForOrder(tx, tenantId, appliedAutoBonusRuleIds)
        : [];

    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(warehouseChanged ? { warehouse_id: warehouseId, warehouse_block_id: null } : {}),
        ...(paymentChanged ? { payment_method_ref: nextPaymentMethodRef } : {}),
        total_sum: paidTotal,
        bonus_sum: bonusSum,
        discount_sum: discountSum,
        bonus_alert: bonusAlert,
        discount_alert: discountAlert,
        comment: linesComment,
        applied_auto_bonus_rule_ids: appliedAutoBonusRuleIds,
        applied_bonus_rules_snapshot: bonusSnapshot as Prisma.InputJsonValue,
        bonus_gift_selections: bonusGiftMapToJson(giftSelectionMap),
        items: {
          create: [
            ...paidAfterDisc.map((l) => ({
              product_id: l.product_id,
              qty: l.qty,
              price: l.price,
              total: l.total,
              is_bonus: false
            })),
            ...bonusCreates
          ]
        }
      }
    });

    const linesPayload: Prisma.InputJsonObject = {
      total_sum: { from: existing.total_sum.toString(), to: paidTotal.toString() },
      bonus_sum: { from: existing.bonus_sum.toString(), to: bonusSum.toString() },
      discount_sum: {
        from: existing.discount_sum.toString(),
        to: discountSum.toString()
      },
      discount_alert: { from: prevDiscountAlert, to: discountAlert },
      bonus_alert: { from: prevBonusAlert, to: bonusAlert },
      ...(alertsClearedAt
        ? {
            alerts_resolved_at: alertsClearedAt,
            alerts_resolved: true
          }
        : {}),
      paid_lines: {
        from: prevPaidItems.map((r) => ({
          product_id: r.product_id,
          qty: r.qty.toString()
        })),
        to: paidAfterDisc.map((l) => ({
          product_id: l.product_id,
          qty: l.qty.toString()
        }))
      }
    };

    await tx.orderChangeLog.create({
      data: {
        order_id: orderId,
        user_id: logUserId,
        action: "lines",
        payload: linesPayload
      }
    });

    return tx.order.findFirstOrThrow({
      where: { id: orderId, tenant_id: tenantId },
      include: orderDetailInclude
    });
  });

  emitOrderUpdated(tenantId, orderId);
  if (warehouseId != null) {
    void invalidateStock(tenantId, warehouseId);
  }

  void appendTenantAuditEvent({
    tenantId,
    actorUserId: logUserId,
    entityType: AuditEntityType.order,
    entityId: String(orderId),
    action: "order.lines",
    payload: {
      order_id: orderId,
      total_sum: updated.total_sum.toString(),
      discount_alert: (updated as { discount_alert?: string | null }).discount_alert ?? null,
      bonus_alert: (updated as { bonus_alert?: string | null }).bonus_alert ?? null
    }
  });

  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, viewerRole);
}
