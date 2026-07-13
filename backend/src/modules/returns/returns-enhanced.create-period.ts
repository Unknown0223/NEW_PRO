import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  assertExchangeInterchangeableProducts,
  assertReturnProductsInterchangeableStrict
} from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import type { CreatePeriodReturnInput, PeriodReturnResult } from "./returns-enhanced.types";
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { getClientReturnsData, POLKI_SOURCE_ORDER_STATUS } from "./returns-enhanced.client-data";
import {
  assertOrderHasPhysicalRemaining,
  computeOrderRemainingPaidRefundCap
} from "./returns-order-balance";
import {
  assertPeriodLineModes,
  computeReturnSplitFromOrderSnapshot,
  finalizePolkiReturnLines,
  priceByProductFromItems,
  validateExplicitReturnAgainstItems,
  validateExplicitReturnQtyAgainstItems,
  validateReturnQty
} from "./returns-enhanced.compute";
import { resolvePolkiBonusDebtAmount } from "./returns-enhanced.bonus-debt";
import {
  resolveOrderDiscountClawback,
  sumPaidNetFromItems,
  type DiscountClawbackResult
} from "./returns-enhanced.discount-debt";
import { reconcileOrderScopedExplicitLinesWithPreview } from "./returns-enhanced.reconcile-order-scoped";
import { assertOrdersInReturnFilter } from "./returns-filter.service";


export async function createPeriodReturn(
  tenantId: number,
  input: CreatePeriodReturnInput,
  actorUserId: number | null
): Promise<PeriodReturnResult> {
  if (!input.lines.length) throw new Error("EMPTY_LINES");

  assertPeriodLineModes(input.lines);

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const productIds = [...new Set(input.lines.map(l => l.product_id))];
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: productIds }, is_active: true },
    select: { id: true, sku: true, name: true }
  });
  if (products.length !== productIds.length) throw new Error("BAD_PRODUCT");
  const pMap = new Map(products.map(p => [p.id, p]));

  await assertReturnProductsInterchangeableStrict(
    tenantId,
    productIds,
    effectiveReturnPriceType(input.price_type)
  );

  // ─── Peresort (almashtirish): manba → fizik qaytariladigan boshqa mahsulot ──
  // Hisob-kitob va validatsiya AYNI manba (`product_id`, zakazdagi mahsulot)
  // bo'yicha o'tadi; yakuniy return/ombor qatoriga esa agent tanlagan boshqa
  // (bir interchangeable guruhdagi) mahsulot yoziladi. Shu sabab guruhda mavjud,
  // ammo zakazda bo'lmagan istalgan mahsulotni ham qaytarish mumkin bo'ladi.
  const peresortMap = new Map<number, number>();
  for (const l of input.lines) {
    const tgt = l.return_as_product_id;
    if (tgt != null && tgt > 0 && tgt !== l.product_id) {
      peresortMap.set(l.product_id, tgt);
    }
  }
  if (peresortMap.size > 0) {
    const retPt = effectiveReturnPriceType(input.price_type);
    for (const [src, tgt] of peresortMap) {
      // Manzil manba bilan bitta faol interchangeable guruhda (va narx turi mos) bo'lishi shart.
      await assertExchangeInterchangeableProducts(tenantId, [src], [tgt], retPt);
    }
    const tgtIds = [...new Set([...peresortMap.values()].filter((id) => !pMap.has(id)))];
    if (tgtIds.length > 0) {
      const tgtProducts = await prisma.product.findMany({
        where: { tenant_id: tenantId, id: { in: tgtIds }, is_active: true },
        select: { id: true, sku: true, name: true }
      });
      if (tgtProducts.length !== tgtIds.length) throw new Error("BAD_PRODUCT");
      for (const p of tgtProducts) pMap.set(p.id, p);
    }
  }

  const warehouseId = input.warehouse_id ?? await findReturnWarehouse(tenantId);

  const orderScoped = input.order_id != null && input.order_id > 0;
  if (orderScoped) {
    const ordOk = await prisma.order.findFirst({
      where: {
        id: input.order_id,
        tenant_id: tenantId,
        client_id: input.client_id,
        status: POLKI_SOURCE_ORDER_STATUS
      },
      select: { id: true }
    });
    if (!ordOk) throw new Error("BAD_ORDER");
    await assertOrdersInReturnFilter(tenantId, input.client_id, [input.order_id!]);
  }

  const cdata = orderScoped
    ? await getClientReturnsData(tenantId, input.client_id, undefined, undefined, input.order_id, undefined, {
        shrinkLineQtyAfterReturns: false
      })
    : await getClientReturnsData(tenantId, input.client_id, input.date_from, input.date_to, undefined, undefined, {
        shrinkLineQtyAfterReturns: false
      });

  if (!orderScoped && cdata.filter_meta?.empty_reason) {
    throw new Error("RETURN_FILTER_EMPTY");
  }

  const allItems = cdata.items.map(i => ({
    product_id: i.product_id, qty: Number(i.qty), price: Number(i.price), is_bonus: i.is_bonus
  }));

  const eligibleOrderIds = orderScoped
    ? [input.order_id!]
    : cdata.orders.map((o) => o.id);

  const returnWhere: Prisma.SalesReturnWhereInput = {
    tenant_id: tenantId,
    client_id: input.client_id,
    // pending ham hisobga olinadi — qabul kutilayotgan vazvrat takror qaytarishni bloklaydi.
    status: { in: ["pending", "posted"] },
    order_id: { in: eligibleOrderIds.length > 0 ? eligibleOrderIds : [-1] }
  };

  const alreadyRetMap = new Map<number, number>();
  const prevReturns = await prisma.salesReturn.findMany({
    where: returnWhere,
    select: {
      order_id: true,
      lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
    }
  });
  for (const ret of prevReturns) {
    for (const ln of ret.lines) {
      alreadyRetMap.set(ln.product_id, (alreadyRetMap.get(ln.product_id) ?? 0) + Number(ln.qty));
    }
  }

  const itemsAdjusted = adjustOrderItemsQtyAfterPriorReturns(
    cdata.items,
    prevReturns.map((r) => ({ order_id: r.order_id, lines: r.lines }))
  );

  if (orderScoped) {
    assertOrderHasPhysicalRemaining(itemsAdjusted);
  }

  const maxRet = orderScoped
    ? computeOrderRemainingPaidRefundCap(itemsAdjusted)
    : new Prisma.Decimal(cdata.max_returnable_value);

  const useExplicit = input.lines.every((l) => !(l.qty != null && l.qty > 0));

  if (!useExplicit) {
    validateReturnQty(allItems, alreadyRetMap, input.lines as { product_id: number; qty: number }[]);
  }

  let retLines: Array<{ product_id: number; qty: number; paid_qty: number; bonus_qty: number; price: number }>;
  let recalc: {
    original_bonus_qty: number;
    remaining_bonus_qty: number;
    excess_bonus: number;
    total_return_qty: number;
    paid_return_qty: number;
    bonus_return_qty: number;
    refund_amount: Prisma.Decimal;
    bonus_cash_applied?: string;
  };

  if (useExplicit) {
    const reconciled =
      orderScoped && !input.skip_order_scoped_reconcile
        ? await reconcileOrderScopedExplicitLinesWithPreview(tenantId, {
            client_id: input.client_id,
            order_id: input.order_id!,
            price_type: input.price_type,
            lines: input.lines
          })
        : null;

    const explicitRows = (reconciled ?? input.lines).map((l) => ({
      product_id: l.product_id,
      paid_qty: l.paid_qty ?? 0,
      bonus_qty: l.bonus_qty ?? 0,
      bonus_cash: l.bonus_cash ?? 0
    }));

    validateReturnQty(
      allItems,
      alreadyRetMap,
      explicitRows
        .filter((er) => er.paid_qty + er.bonus_qty > 0)
        .map((er) => ({ product_id: er.product_id, qty: er.paid_qty + er.bonus_qty }))
    );
    const priceMap = priceByProductFromItems(cdata.items);
    validateExplicitReturnAgainstItems(itemsAdjusted, explicitRows, priceMap);
    validateExplicitReturnQtyAgainstItems(
      itemsAdjusted,
      (reconciled ?? input.lines).map((l) => ({
        product_id: l.product_id,
        return_qty:
          l.return_qty != null && l.return_qty > 0
            ? l.return_qty
            : (l.paid_qty ?? 0) + (l.bonus_qty ?? 0)
      }))
    );

    const physical: Array<{
      product_id: number;
      qty: number;
      paid_qty: number;
      bonus_qty: number;
      price: number;
    }> = [];
    let cashReqTotal = new Prisma.Decimal(0);
    for (const er of explicitRows) {
      const price = priceMap.get(er.product_id) ?? 0;
      if (er.paid_qty + er.bonus_qty > 0) {
        physical.push({
          product_id: er.product_id,
          qty: er.paid_qty + er.bonus_qty,
          paid_qty: er.paid_qty,
          bonus_qty: er.bonus_qty,
          price
        });
      }
      if (er.bonus_cash > 0) cashReqTotal = cashReqTotal.add(R(er.bonus_cash));
    }

    if (physical.length === 0 && !cashReqTotal.gt(0)) throw new Error("EMPTY_LINES");
    if (physical.length === 0 && cashReqTotal.gt(0) && maxRet.lte(0)) {
      throw new Error("NOTHING_TO_RETURN");
    }

    const scaled =
      physical.length > 0
        ? finalizePolkiReturnLines(physical, maxRet, { orderScoped })
        : { lines: [] as typeof physical, refund: new Prisma.Decimal(0) };

    const room = maxRet.sub(scaled.refund);
    const cashApplied = cashReqTotal.lte(0)
      ? new Prisma.Decimal(0)
      : room.gte(cashReqTotal)
        ? cashReqTotal
        : room.gt(0)
          ? room
          : new Prisma.Decimal(0);
    const totalRefund = scaled.refund.add(cashApplied);

    retLines = scaled.lines;
    recalc = {
      original_bonus_qty: 0,
      remaining_bonus_qty: 0,
      excess_bonus: 0,
      total_return_qty: retLines.reduce((a, l) => a + l.qty, 0),
      paid_return_qty: retLines.reduce((a, l) => a + l.paid_qty, 0),
      bonus_return_qty: retLines.reduce((a, l) => a + l.bonus_qty, 0),
      refund_amount: totalRefund,
      bonus_cash_applied: cashApplied.toString()
    };
  } else {
    if (maxRet.lte(0)) throw new Error("NOTHING_TO_RETURN");

    const { lines: rawRetLines, recalc: rawRecalc } = computeReturnSplitFromOrderSnapshot(
      itemsAdjusted,
      input.lines as { product_id: number; qty: number }[]
    );
    const { lines: r2, refund: cappedRefund } = finalizePolkiReturnLines(rawRetLines, maxRet, {
      orderScoped
    });
    retLines = r2;
    recalc = {
      ...rawRecalc,
      refund_amount: cappedRefund,
      paid_return_qty: retLines.reduce((a, l) => a + l.paid_qty, 0),
      bonus_return_qty: retLines.reduce((a, l) => a + l.bonus_qty, 0)
    };
  }

  // Peresort: hisob manba bo'yicha tugadi — endi fizik qaytarilgan mahsulotga
  // (manzilga) qatorlarni qayta nomlaymiz (ombor/hujjat shu mahsulotni oladi).
  if (peresortMap.size > 0) {
    retLines = retLines.map((rl) => {
      const tgt = peresortMap.get(rl.product_id);
      return tgt != null ? { ...rl, product_id: tgt } : rl;
    });
  }

  const bonusDebtAmount = await resolvePolkiBonusDebtAmount(tenantId, input);

  let discountClawback: DiscountClawbackResult | null = null;
  if (orderScoped && input.order_id != null && input.order_id > 0) {
    const remainingPaidNetBefore = sumPaidNetFromItems(itemsAdjusted);
    const thisReturnPaidNet = retLines.reduce(
      (a, l) => a.add(R(l.price).mul(l.paid_qty)),
      new Prisma.Decimal(0)
    );
    discountClawback = await resolveOrderDiscountClawback(
      tenantId,
      input.order_id,
      thisReturnPaidNet,
      remainingPaidNetBefore
    );
  }

  const number = `VR-${tenantId}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const uid = actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const mirrorOrderType: "return" | "return_by_order" = orderScoped ? "return_by_order" : "return";
  const sourceOrderNumber =
    orderScoped && cdata.orders[0]?.number ? String(cdata.orders[0].number) : null;

  const discountDebtAmount =
    discountClawback != null && discountClawback.amount.gt(0) ? discountClawback.amount : null;
  const discountDebtNote =
    discountDebtAmount != null && discountClawback?.note
      ? discountClawback.note.slice(0, 500)
      : null;
  const discountSumAfter =
    discountClawback != null ? discountClawback.new_discount_sum : null;

  const { ret: result, mirrorOrderId } = await prisma.$transaction(async (tx) => {
    const ret = await tx.salesReturn.create({
      data: {
        tenant_id: tenantId, number,
        client_id: input.client_id,
        order_id: input.order_id ?? null,
        warehouse_id: warehouseId,
        // Zavsklad qabulini kutadi — side-effect'lar qabulda qo'llanadi.
        status: "pending",
        refund_amount: recalc.refund_amount,
        bonus_debt_amount: bonusDebtAmount.gt(0) ? bonusDebtAmount : null,
        discount_debt_amount: discountDebtAmount,
        discount_debt_note: discountDebtNote,
        discount_sum_after: discountSumAfter,
        return_type: "partial",
        date_from:
          orderScoped ? null : input.date_from ? new Date(input.date_from) : null,
        date_to: orderScoped ? null : input.date_to ? new Date(input.date_to) : null,
        note: input.note?.trim() || null,
        refusal_reason_ref:
          input.refusal_reason_ref != null && String(input.refusal_reason_ref).trim()
            ? String(input.refusal_reason_ref).trim().slice(0, 128)
            : null,
        created_by_user_id: uid,
        ...(retLines.length > 0
          ? {
              lines: {
                create: retLines.map((rl) => ({
                  product_id: rl.product_id,
                  qty: new Prisma.Decimal(rl.qty),
                  paid_qty: new Prisma.Decimal(rl.paid_qty),
                  bonus_qty: new Prisma.Decimal(rl.bonus_qty)
                }))
              }
            }
          : {})
      },
      include: {
        client: { select: { name: true } },
        order: { select: { number: true } },
        warehouse: { select: { name: true } }
      }
    });

    const mirrorOrderId = await createPolkiMirrorZayavka(tx, {
      tenantId,
      number,
      clientId: input.client_id,
      warehouseId,
      orderType: mirrorOrderType,
      retLines,
      refundAmount: recalc.refund_amount,
      note: input.note?.trim() || null,
      refusalReasonRef: input.refusal_reason_ref ?? null,
      sourceOrderNumber,
      actorUserId: uid,
      discountDebtAmount: discountDebtAmount,
      discountDebtNote: discountDebtNote,
      discountPct: discountClawback?.discount_pct ?? null
    });

    // Side-effect'lar (ostatka / balans / bonus / auto-mark) qabulda qo'llanadi —
    // bu yerda faqat ko'zgu «заявка» ni hujjatga bog'laymiz.
    await tx.salesReturn.update({
      where: { id: ret.id },
      data: { mirror_order_id: mirrorOrderId }
    });

    return { ret, mirrorOrderId };
  });

  emitOrderUpdated(tenantId, mirrorOrderId);
  void invalidateDashboard(tenantId);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: String(input.client_id),
    action: "period_return",
    payload: {
      return_id: result.id,
      number: result.number,
      bonus_recalc: {
        original_bonus_qty: recalc.original_bonus_qty,
        remaining_bonus_qty: recalc.remaining_bonus_qty,
        excess_bonus: recalc.excess_bonus,
        total_return_qty: recalc.total_return_qty,
        paid_return_qty: recalc.paid_return_qty,
        bonus_return_qty: recalc.bonus_return_qty,
        refund_amount: recalc.refund_amount.toString(),
        ...(recalc.bonus_cash_applied != null ? { bonus_cash_applied: recalc.bonus_cash_applied } : {}),
        ...(bonusDebtAmount.gt(0)
          ? {
              bonus_debt_amount: bonusDebtAmount.toString(),
              bonus_debt_qty: null
            }
          : {}),
        ...(discountDebtAmount != null
          ? {
              discount_debt_amount: discountDebtAmount.toString(),
              discount_debt_mode: discountClawback?.mode ?? null,
              discount_sum_after: discountClawback?.new_discount_sum.toString() ?? null
            }
          : {})
      },
      mirror_order_id: mirrorOrderId
    }
  });

  return {
    id: result.id, number: result.number,
    refund_amount: result.refund_amount?.toString() ?? null,
    discount_debt_amount: discountDebtAmount?.toString() ?? null,
    discount_debt_note: discountDebtNote,
    lines: retLines.map(rl => ({
      product_id: rl.product_id,
      sku: pMap.get(rl.product_id)?.sku ?? "",
      name: pMap.get(rl.product_id)?.name ?? "",
      qty: String(rl.qty),
      paid_qty: String(rl.paid_qty),
      bonus_qty: String(rl.bonus_qty),
      paid_amount: R(rl.price).mul(rl.paid_qty).toString()
    })),
    bonus_recalc: {
      ...recalc,
      refund_amount: recalc.refund_amount.toString(),
      ...(bonusDebtAmount.gt(0) ? { bonus_debt_amount: bonusDebtAmount.toString() } : {})
    }
  };
}
