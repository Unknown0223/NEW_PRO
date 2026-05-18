import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import type { CreatePeriodReturnInput, PeriodReturnResult } from "./returns-enhanced.types";
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { MAX_RETURN_ITEMS } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { getClientReturnsData, POLKI_SOURCE_ORDER_STATUS } from "./returns-enhanced.client-data";
import { localDayEnd, localDayStart } from "./returns-enhanced.helpers";
import {
  assertPeriodLineModes,
  computeReturnSplitFromOrderSnapshot,
  physicalQtyFromPeriodLine,
  priceByProductFromItems,
  scaleReturnLinesToMaxRefund,
  validateExplicitReturnAgainstItems,
  validateReturnQty
} from "./returns-enhanced.compute";
import { autoMarkReturnedOrders } from "./returns-enhanced.auto-mark";


export async function createPeriodReturn(
  tenantId: number,
  input: CreatePeriodReturnInput,
  actorUserId: number | null
): Promise<PeriodReturnResult> {
  if (!input.lines.length) throw new Error("EMPTY_LINES");

  assertPeriodLineModes(input.lines);
  const totalPhys = input.lines.reduce((a, l) => a + physicalQtyFromPeriodLine(l), 0);
  if (totalPhys > MAX_RETURN_ITEMS) throw new Error("TOO_MANY_ITEMS");

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
  }

  const cdata = orderScoped
    ? await getClientReturnsData(tenantId, input.client_id, undefined, undefined, input.order_id, undefined, {
        shrinkLineQtyAfterReturns: false
      })
    : await getClientReturnsData(tenantId, input.client_id, input.date_from, input.date_to, undefined, undefined, {
        shrinkLineQtyAfterReturns: false
      });

  const allItems = cdata.items.map(i => ({
    product_id: i.product_id, qty: Number(i.qty), price: Number(i.price), is_bonus: i.is_bonus
  }));

  const returnWhere: Prisma.SalesReturnWhereInput = {
    tenant_id: tenantId, client_id: input.client_id, status: "posted"
  };
  if (orderScoped) {
    returnWhere.order_id = input.order_id;
  } else {
    if (input.date_from) returnWhere.created_at = { gte: localDayStart(input.date_from) };
    if (input.date_to) {
      returnWhere.created_at = {
        ...(returnWhere.created_at as object) ?? {},
        lte: localDayEnd(input.date_to)
      };
    }
  }

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

  const useExplicit = input.lines.every((l) => !(l.qty != null && l.qty > 0));

  if (!useExplicit) {
    validateReturnQty(allItems, alreadyRetMap, input.lines as { product_id: number; qty: number }[]);
  }

  const maxRet = new Prisma.Decimal(cdata.max_returnable_value);

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
    const explicitRows = input.lines.map((l) => ({
      product_id: l.product_id,
      paid_qty: l.paid_qty ?? 0,
      bonus_qty: l.bonus_qty ?? 0,
      bonus_cash: l.bonus_cash ?? 0
    }));
    const priceMap = priceByProductFromItems(cdata.items);
    validateExplicitReturnAgainstItems(itemsAdjusted, explicitRows, priceMap);

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
        ? scaleReturnLinesToMaxRefund(physical, maxRet)
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
    const { lines: r2, refund: cappedRefund } = scaleReturnLinesToMaxRefund(rawRetLines, maxRet);
    retLines = r2;
    recalc = {
      ...rawRecalc,
      refund_amount: cappedRefund,
      paid_return_qty: retLines.reduce((a, l) => a + l.paid_qty, 0),
      bonus_return_qty: retLines.reduce((a, l) => a + l.bonus_qty, 0)
    };
  }

  const number = `VR-${tenantId}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const uid = actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const mirrorOrderType: "return" | "return_by_order" = orderScoped ? "return_by_order" : "return";
  const sourceOrderNumber =
    orderScoped && cdata.orders[0]?.number ? String(cdata.orders[0].number) : null;

  const { ret: result, mirrorOrderId } = await prisma.$transaction(async (tx) => {
    const ret = await tx.salesReturn.create({
      data: {
        tenant_id: tenantId, number,
        client_id: input.client_id,
        order_id: input.order_id ?? null,
        warehouse_id: warehouseId,
        status: "posted",
        refund_amount: recalc.refund_amount,
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
      sourceOrderNumber
    });

    // Stock: add to return warehouse
    for (const rl of retLines) {
      if (!(rl.qty > 0)) continue;
      const delta = new Prisma.Decimal(rl.qty);
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId, warehouse_id: warehouseId, product_id: rl.product_id
          }
        },
        create: { tenant_id: tenantId, warehouse_id: warehouseId, product_id: rl.product_id, qty: delta },
        update: { qty: { increment: delta } }
      });
    }

    // Client balance
    if (recalc.refund_amount.gt(0)) {
      const bal = await tx.clientBalance.upsert({
        where: { tenant_id_client_id: { tenant_id: tenantId, client_id: input.client_id } },
        create: { tenant_id: tenantId, client_id: input.client_id, balance: recalc.refund_amount },
        update: { balance: { increment: recalc.refund_amount } }
      });
      await tx.clientBalanceMovement.create({
        data: { client_balance_id: bal.id, delta: recalc.refund_amount, note: `Vazvrat: ${number}`, user_id: uid }
      });
    }

    return { ret, mirrorOrderId };
  });

  emitOrderUpdated(tenantId, mirrorOrderId);
  void invalidateDashboard(tenantId);
  void invalidateStock(tenantId, warehouseId);

  await autoMarkReturnedOrders(
    tenantId,
    input.client_id,
    orderScoped ? undefined : input.date_from,
    orderScoped ? undefined : input.date_to,
    uid
  );

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
        ...(recalc.bonus_cash_applied != null ? { bonus_cash_applied: recalc.bonus_cash_applied } : {})
      },
      mirror_order_id: mirrorOrderId
    }
  });

  return {
    id: result.id, number: result.number,
    refund_amount: result.refund_amount?.toString() ?? null,
    lines: retLines.map(rl => ({
      product_id: rl.product_id,
      sku: pMap.get(rl.product_id)?.sku ?? "",
      name: pMap.get(rl.product_id)?.name ?? "",
      qty: String(rl.qty),
      paid_qty: String(rl.paid_qty),
      bonus_qty: String(rl.bonus_qty),
      paid_amount: R(rl.price).mul(rl.paid_qty).toString()
    })),
    bonus_recalc: { ...recalc, refund_amount: recalc.refund_amount.toString() }
  };
}
