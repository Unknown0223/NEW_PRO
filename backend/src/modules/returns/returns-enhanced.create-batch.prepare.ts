import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import type {
  CreatePeriodReturnBatchInput,
  CreatePeriodReturnLine,
  PeriodReturnBatchResult,
  PeriodReturnResult
} from "./returns-enhanced.types";
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { MAX_RETURN_ITEMS } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { getClientReturnsData, POLKI_SOURCE_ORDER_STATUS } from "./returns-enhanced.client-data";
import {
  assertBatchLineModes,
  computeReturnSplitFromOrderSnapshot,
  periodReturnUsesExplicitLines,
  physicalQtyFromPeriodLine,
  priceByProductFromItems,
  scaleReturnLinesToMaxRefund,
  validateExplicitReturnAgainstItems,
  validateExplicitReturnQtyAgainstItems,
  validateReturnQty
} from "./returns-enhanced.compute";
import { autoMarkReturnedOrders } from "./returns-enhanced.auto-mark";

export type PreparedPeriodReturnSlice = {
  orderId: number;
  sourceOrderNumber: string;
  retLines: Array<{
    product_id: number;
    qty: number;
    paid_qty: number;
    bonus_qty: number;
    price: number;
  }>;
  recalc: {
    original_bonus_qty: number;
    remaining_bonus_qty: number;
    excess_bonus: number;
    total_return_qty: number;
    paid_return_qty: number;
    bonus_return_qty: number;
    refund_amount: import("@prisma/client").Prisma.Decimal;
  };
  number: string;
};

export type PreparePeriodReturnBatchResult = {
  tenantId: number;
  input: import("./returns-enhanced.types").CreatePeriodReturnBatchInput;
  actorUserId: number | null;
  prepared: PreparedPeriodReturnSlice[];
  warehouseId: number;
  uid: number | null;
  pMap: Map<number, { sku: string; name: string }>;
};

export async function preparePeriodReturnBatch(
  tenantId: number,
  input: import("./returns-enhanced.types").CreatePeriodReturnBatchInput,
  actorUserId: number | null
): Promise<PreparePeriodReturnBatchResult> {
  if (!input.lines.length) throw new Error("EMPTY_LINES");

  assertBatchLineModes(input.lines);
  const totalPhys = input.lines.reduce((a, l) => a + physicalQtyFromPeriodLine(l), 0);
  const explicitPolki =
    periodReturnUsesExplicitLines(input.lines) ||
    (input.bonus_debt_amount != null && Number(input.bonus_debt_amount) > 0);
  if (totalPhys > MAX_RETURN_ITEMS && !explicitPolki) throw new Error("TOO_MANY_ITEMS");

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const productIds = [...new Set(input.lines.map((l) => l.product_id))];
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: productIds }, is_active: true },
    select: { id: true, sku: true, name: true }
  });
  if (products.length !== productIds.length) throw new Error("BAD_PRODUCT");
  const pMap = new Map(products.map((p) => [p.id, p]));

  await assertReturnProductsInterchangeableStrict(
    tenantId,
    productIds,
    effectiveReturnPriceType(input.price_type)
  );

  const warehouseId = input.warehouse_id ?? await findReturnWarehouse(tenantId);

  const batchExplicit = input.lines.every((l) => !(l.qty != null && l.qty > 0));

  const byOrder = new Map<
    number,
    | { mode: "legacy"; lines: { product_id: number; qty: number }[] }
    | { mode: "explicit"; lines: CreatePeriodReturnLine[] }
  >();

  if (batchExplicit) {
    const acc = new Map<number, Map<number, { paid: number; bonus: number; cash: number }>>();
    for (const ln of input.lines) {
      const oid = ln.order_id;
      if (!Number.isFinite(oid) || oid < 1) throw new Error("BAD_ORDER");
      const pmap = acc.get(oid) ?? new Map<number, { paid: number; bonus: number; cash: number }>();
      const cur = pmap.get(ln.product_id) ?? { paid: 0, bonus: 0, cash: 0 };
      cur.paid += ln.paid_qty ?? 0;
      cur.bonus += ln.bonus_qty ?? 0;
      cur.cash += ln.bonus_cash ?? 0;
      pmap.set(ln.product_id, cur);
      acc.set(oid, pmap);
    }
    for (const [oid, pmap] of acc) {
      byOrder.set(oid, {
        mode: "explicit",
        lines: Array.from(pmap.entries()).map(([product_id, v]) => ({
          product_id,
          paid_qty: v.paid,
          bonus_qty: v.bonus,
          bonus_cash: v.cash
        }))
      });
    }
  } else {
    const byOrderQty = new Map<number, Map<number, number>>();
    for (const ln of input.lines) {
      const oid = ln.order_id;
      if (!Number.isFinite(oid) || oid < 1) throw new Error("BAD_ORDER");
      const q = ln.qty ?? 0;
      if (!(q > 0)) throw new Error("EMPTY_LINE");
      const pmap = byOrderQty.get(oid) ?? new Map<number, number>();
      pmap.set(ln.product_id, (pmap.get(ln.product_id) ?? 0) + q);
      byOrderQty.set(oid, pmap);
    }
    for (const [oid, pmap] of byOrderQty) {
      byOrder.set(oid, {
        mode: "legacy",
        lines: Array.from(pmap.entries()).map(([product_id, qty]) => ({ product_id, qty }))
      });
    }
  }

  for (const oid of byOrder.keys()) {
    const ordOk = await prisma.order.findFirst({
      where: {
        id: oid,
        tenant_id: tenantId,
        client_id: input.client_id,
        status: POLKI_SOURCE_ORDER_STATUS
      },
      select: { id: true }
    });
    if (!ordOk) throw new Error("BAD_ORDER");
  }

  type PreparedSlice = {
    orderId: number;
    sourceOrderNumber: string;
    retLines: Array<{
      product_id: number;
      qty: number;
      paid_qty: number;
      bonus_qty: number;
      price: number;
    }>;
    recalc: {
      original_bonus_qty: number;
      remaining_bonus_qty: number;
      excess_bonus: number;
      total_return_qty: number;
      paid_return_qty: number;
      bonus_return_qty: number;
      refund_amount: Prisma.Decimal;
    };
    number: string;
  };

  const prepared: PreparedSlice[] = [];
  const orderEntries = Array.from(byOrder.entries()).sort((a, b) => a[0] - b[0]);

  for (const [orderId, slice] of orderEntries) {
    const cdata = await getClientReturnsData(
      tenantId,
      input.client_id,
      undefined,
      undefined,
      orderId,
      undefined,
      { shrinkLineQtyAfterReturns: false }
    );
    const allItems = cdata.items.map((i) => ({
      product_id: i.product_id,
      qty: Number(i.qty),
      price: Number(i.price),
      is_bonus: i.is_bonus
    }));

    const returnWhere: Prisma.SalesReturnWhereInput = {
      tenant_id: tenantId,
      client_id: input.client_id,
      status: "posted",
      order_id: orderId
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

    const maxRet = new Prisma.Decimal(cdata.max_returnable_value);

    let retLines: PreparedSlice["retLines"];
    let recalc: PreparedSlice["recalc"];

    if (slice.mode === "legacy") {
      validateReturnQty(allItems, alreadyRetMap, slice.lines);
      if (maxRet.lte(0)) throw new Error("NOTHING_TO_RETURN");

      const { lines: rawRetLines, recalc: rawRecalc } = computeReturnSplitFromOrderSnapshot(
        itemsAdjusted,
        slice.lines
      );
      const { lines: r2, refund: cappedRefund } = scaleReturnLinesToMaxRefund(rawRetLines, maxRet);
      retLines = r2;
      recalc = {
        ...rawRecalc,
        refund_amount: cappedRefund,
        paid_return_qty: retLines.reduce((a, l) => a + l.paid_qty, 0),
        bonus_return_qty: retLines.reduce((a, l) => a + l.bonus_qty, 0)
      };
    } else {
      const explicitRows = slice.lines.map((l) => ({
        product_id: l.product_id,
        paid_qty: l.paid_qty ?? 0,
        bonus_qty: l.bonus_qty ?? 0,
        bonus_cash: l.bonus_cash ?? 0
      }));
      const priceMap = priceByProductFromItems(cdata.items);
      validateExplicitReturnAgainstItems(itemsAdjusted, explicitRows, priceMap);
      validateExplicitReturnQtyAgainstItems(itemsAdjusted, slice.lines);

      const physical: PreparedSlice["retLines"] = [];
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
          : { lines: [] as PreparedSlice["retLines"], refund: new Prisma.Decimal(0) };

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
        refund_amount: totalRefund
      };
    }

    const number = `VR-${tenantId}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const sourceOrderNumber = cdata.orders[0]?.number?.trim() || String(orderId);
    prepared.push({ orderId, sourceOrderNumber, retLines, recalc, number });
  }

  const uid = actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  return { tenantId, input, actorUserId, prepared, warehouseId, uid, pMap };
}
