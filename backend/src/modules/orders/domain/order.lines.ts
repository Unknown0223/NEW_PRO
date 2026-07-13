/**
 * Domain: Orders — zakaz qatorlari (PATCH lines).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import { invalidateStock } from "../../../lib/redis-cache";
import { getProductPrice } from "../../products/product-prices.service";
import { parseBonusStackPolicy } from "../bonus-stack-policy";
import { buildAppliedBonusRulesSnapshotForOrder } from "../order-bonus-snapshot.persist";
import {
  fetchClientUsedAutoBonusRuleIdsExcludingOrder,
  resolveOrderBonusesForCreate,
  type OrderAgentBonusContext
} from "../order-bonus-apply";
import { capBonusCreatesToStock, mergeOrderAutoComments } from "../order-bonus-stock-cap";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE, normalizeOrderType } from "../order-status";

import {
  bonusGiftMapToJson,
  enrichOrderDetailRow,
  parseBonusGiftSelectionsJson,
  roundOrderMoney,
  validateBonusGiftOverrides
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderLinesInput
} from "./order.types";

export const ORDER_LINES_EDITABLE_STATUSES = new Set(["new", "confirmed"]);

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

  const prevPaidItems = await prisma.orderItem.findMany({
    where: { order_id: orderId, is_bonus: false },
    orderBy: { id: "asc" },
    select: { product_id: true, qty: true }
  });

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

  const warehouseId =
    input.warehouse_id !== undefined ? input.warehouse_id : existing.warehouse_id;
  const agentId = input.agent_id !== undefined ? input.agent_id : existing.agent_id;

  const existingOrderType = normalizeOrderType(existing.order_type ?? "order");
  const existingPm =
    (existing as { payment_method_ref?: string | null }).payment_method_ref?.trim() || null;
  const mergedPaymentMethodRef =
    input.payment_method_ref !== undefined
      ? input.payment_method_ref === null
        ? null
        : input.payment_method_ref.trim().slice(0, 64) || null
      : existingPm;

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
    const priceStr = await getProductPrice(tenantId, it.product_id, "retail");
    if (priceStr == null) {
      const e = new Error("NO_PRICE") as Error & { product_id: number; price_type: string };
      e.product_id = it.product_id;
      e.price_type = "retail";
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
    let paidAfterDisc = lineData;
    let paidTotal = totalSum;
    let bonusDrafts: Array<{
      product_id: number;
      qty: Prisma.Decimal;
      price: Prisma.Decimal;
      total: Prisma.Decimal;
    }> = [];
    let appliedAutoBonusRuleIds: number[] = [];
    if (applyBonus) {
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
        orderAgentForBonus
      );
      paidAfterDisc = resolved.lines;
      paidTotal = resolved.total;
      bonusDrafts = resolved.bonusDrafts;
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
    let linesComment = existing.comment ?? null;
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
      applyBonus && rawDiscUp.gt(0) ? roundOrderMoney(rawDiscUp) : new Prisma.Decimal(0);

    const creditLimit = client.credit_limit;
    if (creditLimit.gt(0)) {
      const balRow = await tx.clientBalance.findUnique({
        where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } },
        select: { balance: true }
      });
      const accountBalance = balRow?.balance ?? new Prisma.Decimal(0);
      const headroom = creditLimit.add(accountBalance);
      const agg = await tx.order.aggregate({
        where: {
          tenant_id: tenantId,
          client_id: client.id,
          id: { not: orderId },
          status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
        },
        _sum: { total_sum: true }
      });
      const outstanding = agg._sum.total_sum ?? new Prisma.Decimal(0);
      const projected = outstanding.add(paidTotal);
      if (projected.gt(headroom)) {
        const err = new Error("CREDIT_LIMIT_EXCEEDED") as Error & {
          credit_limit: string;
          outstanding: string;
          order_total: string;
        };
        err.credit_limit = headroom.toString();
        err.outstanding = outstanding.toString();
        err.order_total = paidTotal.toString();
        throw err;
      }
    }

    await tx.orderItem.deleteMany({ where: { order_id: orderId } });

    const warehouseChangedForBlock =
      input.warehouse_id !== undefined && warehouseId !== existing.warehouse_id;

    const bonusSnapshot =
      appliedAutoBonusRuleIds.length > 0
        ? await buildAppliedBonusRulesSnapshotForOrder(tx, tenantId, appliedAutoBonusRuleIds)
        : [];

    await tx.order.update({
      where: { id: orderId },
      data: {
        warehouse_id: warehouseId,
        agent_id: agentId,
        ...(warehouseChangedForBlock ? { warehouse_block_id: null } : {}),
        ...(input.payment_method_ref !== undefined
          ? { payment_method_ref: mergedPaymentMethodRef }
          : {}),
        total_sum: paidTotal,
        bonus_sum: bonusSum,
        discount_sum: discountSum,
        bonus_alert: bonusAlert,
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

    const prevOrderBlockId =
      (existing as { warehouse_block_id?: number | null }).warehouse_block_id ?? null;
    const linesPayload: Prisma.InputJsonObject = {
      total_sum: { from: existing.total_sum.toString(), to: paidTotal.toString() },
      bonus_sum: { from: existing.bonus_sum.toString(), to: bonusSum.toString() },
      discount_sum: {
        from: existing.discount_sum.toString(),
        to: discountSum.toString()
      },
      warehouse_id: { from: existing.warehouse_id, to: warehouseId },
      agent_id: { from: existing.agent_id, to: agentId },
      ...(warehouseChangedForBlock && prevOrderBlockId != null
        ? { warehouse_block_id: { from: prevOrderBlockId, to: null } }
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
  if (existing.warehouse_id != null && existing.warehouse_id !== warehouseId) {
    void invalidateStock(tenantId, existing.warehouse_id);
  }
  return enrichOrderDetailRow(tenantId, updated as unknown as OrderDetailLoaded, viewerRole);
}
