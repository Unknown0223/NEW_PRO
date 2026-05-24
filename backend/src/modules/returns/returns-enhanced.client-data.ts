import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import type { ClientReturnsData, OrderItemSummary } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, localDayEnd, localDayStart, R } from "./returns-enhanced.helpers";
import { computeOrderReturnBalance, computeOrderRemainingPaidRefundCap } from "./returns-order-balance";

export const POLKI_SOURCE_ORDER_STATUS = "delivered" as const;

/** Bir nechta zakaz uchun qaytarish konteksti (har qator `order_id` bilan). */
async function getClientReturnsDataMultipleOrders(
  tenantId: number,
  clientId: number,
  orderIds: number[]
): Promise<ClientReturnsData> {
  const uniqueSorted = [...new Set(orderIds)].sort((a, b) => a - b);
  const orders = await prisma.order.findMany({
    where: {
      id: { in: uniqueSorted },
      tenant_id: tenantId,
      client_id: clientId,
      status: POLKI_SOURCE_ORDER_STATUS
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      created_at: true,
      items: {
        select: {
          product_id: true,
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { sku: true, name: true, unit: true, category_id: true } }
        }
      }
    }
  });
  if (orders.length === 0) throw new Error("BAD_ORDER");
  if (orders.length !== uniqueSorted.length) throw new Error("ORDER_NOT_DELIVERED");

  const loadedOrderIds = orders.map((o) => o.id);

  const returns = await prisma.salesReturn.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      order_id: { in: loadedOrderIds },
      status: "posted"
    },
    select: {
      order_id: true,
      refund_amount: true,
      lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
    }
  });

  const totalReturnedQty = returns.reduce(
    (a, ret) => a + ret.lines.reduce((b, l) => b + Number(l.qty), 0),
    0
  );
  const alreadyReturned = returns.reduce(
    (a, r) => a.add(r.refund_amount ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0)
  );

  let totalPaidValue = new Prisma.Decimal(0);
  const items: OrderItemSummary[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      items.push({
        product_id: item.product_id,
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit,
        qty: item.qty.toString(),
        price: item.price.toString(),
        total: item.total.toString(),
        is_bonus: item.is_bonus,
        order_id: order.id,
        order_number: order.number,
        category_id: item.product.category_id
      });
      if (!item.is_bonus) totalPaidValue = totalPaidValue.add(item.total);
    }
  }

  const itemsAdjusted = adjustOrderItemsQtyAfterPriorReturns(items, returns);
  const orderBalances = orders.map((o) => {
    const orig = items.filter((i) => i.order_id === o.id);
    const rem = itemsAdjusted.filter((i) => i.order_id === o.id);
    return computeOrderReturnBalance(o.id, orig, rem, returns);
  });

  const bal = await prisma.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
    select: { balance: true }
  });
  const balance = bal?.balance ?? new Prisma.Decimal(0);
  const maxReturnable = totalPaidValue.sub(alreadyReturned);

  return {
    polki_scope: "order",
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total_sum: o.total_sum.toString(),
      bonus_sum: o.bonus_sum.toString(),
      created_at: o.created_at.toISOString()
    })),
    items: itemsAdjusted,
    order_balance: orderBalances.length === 1 ? orderBalances[0]! : null,
    order_balances: orderBalances,
    total_orders: orders.length,
    total_returned_qty: String(totalReturnedQty),
    total_paid_value: totalPaidValue.toString(),
    already_returned_value: alreadyReturned.toString(),
    max_returnable_value: maxReturnable.gt(0) ? maxReturnable.toString() : "0",
    client_balance: balance.toString(),
    client_debt: balance.lt(0) ? balance.abs().toString() : "0"
  };
}

// ─── Get client returns data ────────────────────────────────────────────────
//
// Qayta «vozvrat s polki» shu zakazga: oldingi posted `sales_return` qatorlari
// `adjustOrderItemsQtyAfterPriorReturns` orqali qoldiqni kamaytiradi — qoldiq
// bo‘lsa, yana xuddi shu zakazdan qaytarish mumkin (backend tekshiruvi).

export async function getClientReturnsData(
  tenantId: number,
  clientId: number,
  dateFrom?: string,
  dateTo?: string,
  orderId?: number | null,
  orderIds?: number[] | null,
  opts?: { shrinkLineQtyAfterReturns?: boolean }
): Promise<ClientReturnsData> {
  const shrinkLineQtyAfterReturns = opts?.shrinkLineQtyAfterReturns !== false;

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const resolvedOrderIds =
    orderIds != null && orderIds.length > 0
      ? [...new Set(orderIds.map(Number).filter((x) => Number.isFinite(x) && x > 0))]
      : orderId != null && orderId > 0
        ? [orderId]
        : [];

  if (resolvedOrderIds.length > 1) {
    return getClientReturnsDataMultipleOrders(tenantId, clientId, resolvedOrderIds);
  }

  // ─── Bitta zakaz (polki po zakaz) ─────────────────────────────────────
  const singleOrderId = resolvedOrderIds.length === 1 ? resolvedOrderIds[0]! : null;
  if (singleOrderId != null) {
    const order = await prisma.order.findFirst({
      where: {
        id: singleOrderId,
        tenant_id: tenantId,
        client_id: clientId,
        status: POLKI_SOURCE_ORDER_STATUS
      },
      select: {
        id: true,
        number: true,
        status: true,
        total_sum: true,
        bonus_sum: true,
        created_at: true,
        items: {
          select: {
            product_id: true,
            qty: true,
            price: true,
            total: true,
            is_bonus: true,
            product: { select: { sku: true, name: true, unit: true, category_id: true } }
          }
        }
      }
    });
    if (!order) throw new Error("BAD_ORDER");

    const returns = await prisma.salesReturn.findMany({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        order_id: singleOrderId,
        status: "posted"
      },
      select: {
        order_id: true,
        refund_amount: true,
        lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
      }
    });

    const totalReturnedQty = returns.reduce(
      (a, ret) => a + ret.lines.reduce((b, l) => b + Number(l.qty), 0),
      0
    );
    const alreadyReturned = returns.reduce(
      (a, r) => a.add(r.refund_amount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0)
    );

    let totalPaidValue = new Prisma.Decimal(0);
    const items: OrderItemSummary[] = [];
    for (const item of order.items) {
      items.push({
        product_id: item.product_id,
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit,
        qty: item.qty.toString(),
        price: item.price.toString(),
        total: item.total.toString(),
        is_bonus: item.is_bonus,
        order_id: order.id,
        order_number: order.number,
        category_id: item.product.category_id
      });
      if (!item.is_bonus) totalPaidValue = totalPaidValue.add(item.total);
    }

    const itemsOut = shrinkLineQtyAfterReturns
      ? adjustOrderItemsQtyAfterPriorReturns(items, returns)
      : items;
    const orderBalance = computeOrderReturnBalance(singleOrderId, items, itemsOut, returns);

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      select: { balance: true }
    });
    const balance = bal?.balance ?? new Prisma.Decimal(0);
    const remainingRefundCap = computeOrderRemainingPaidRefundCap(itemsOut);

    return {
      polki_scope: "order",
      orders: [
        {
          id: order.id,
          number: order.number,
          status: order.status,
          total_sum: order.total_sum.toString(),
          bonus_sum: order.bonus_sum.toString(),
          created_at: order.created_at.toISOString()
        }
      ],
      items: itemsOut,
      order_balance: orderBalance,
      order_balances: [orderBalance],
      total_orders: 1,
      total_returned_qty: String(totalReturnedQty),
      total_paid_value: totalPaidValue.toString(),
      already_returned_value: alreadyReturned.toString(),
      max_returnable_value: remainingRefundCap.gt(0) ? remainingRefundCap.toString() : "0",
      client_balance: balance.toString(),
      client_debt: balance.lt(0) ? balance.abs().toString() : "0"
    };
  }

  // Orders in period — faqat yetkazilgan sotuvlar (polki «с полки»)
  const orderWhere: Prisma.OrderWhereInput = {
    tenant_id: tenantId,
    client_id: clientId,
    status: POLKI_SOURCE_ORDER_STATUS
  };
  if (dateFrom) orderWhere.created_at = { gte: localDayStart(dateFrom) };
  if (dateTo) orderWhere.created_at = { ...(orderWhere.created_at as object) ?? {}, lte: localDayEnd(dateTo) };

  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { created_at: "desc" },
    select: {
      id: true, number: true, status: true,
      total_sum: true, bonus_sum: true, created_at: true,
      items: {
        select: {
          product_id: true, qty: true, price: true, total: true, is_bonus: true,
          product: { select: { sku: true, name: true, unit: true, category_id: true } }
        }
      }
    }
  });

  // Aggregate returned qty per product from existing returns in period
  const returnWhere: Prisma.SalesReturnWhereInput = {
    tenant_id: tenantId, client_id: clientId, status: "posted"
  };
  if (dateFrom) returnWhere.created_at = { gte: localDayStart(dateFrom) };
  if (dateTo) returnWhere.created_at = { ...(returnWhere.created_at as object) ?? {}, lte: localDayEnd(dateTo) };

  const returns = await prisma.salesReturn.findMany({
    where: returnWhere, select: { refund_amount: true, lines: { select: { product_id: true, qty: true } } }
  });

  const returnedQtyByProduct = new Map<number, number>();
  for (const ret of returns) {
    for (const ln of ret.lines) {
      returnedQtyByProduct.set(ln.product_id, (returnedQtyByProduct.get(ln.product_id) ?? 0) + Number(ln.qty));
    }
  }
  const totalReturnedQty = returns.reduce((a, ret) => a + ret.lines.reduce((b, l) => b + Number(l.qty), 0), 0);

  const alreadyReturned = returns.reduce((a, r) => a.add(r.refund_amount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));

  let totalPaidValue = new Prisma.Decimal(0);
  const items: OrderItemSummary[] = [];

  for (const o of orders) {
    for (const item of o.items) {
      items.push({
        product_id: item.product_id,
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit,
        qty: item.qty.toString(),
        price: item.price.toString(),
        total: item.total.toString(),
        is_bonus: item.is_bonus,
        order_id: o.id,
        order_number: o.number,
        category_id: item.product.category_id
      });
      if (!item.is_bonus) totalPaidValue = totalPaidValue.add(item.total);
    }
  }

  const bal = await prisma.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
    select: { balance: true }
  });
  const balance = bal?.balance ?? new Prisma.Decimal(0);
  const maxReturnable = totalPaidValue.sub(alreadyReturned);

  return {
    polki_scope: "period",
    orders: orders.map(o => ({
      id: o.id, number: o.number, status: o.status,
      total_sum: o.total_sum.toString(), bonus_sum: o.bonus_sum.toString(),
      created_at: o.created_at.toISOString()
    })),
    items,
    total_orders: orders.length,
    total_returned_qty: String(totalReturnedQty),
    total_paid_value: totalPaidValue.toString(),
    already_returned_value: alreadyReturned.toString(),
    max_returnable_value: maxReturnable.gt(0) ? maxReturnable.toString() : "0",
    client_balance: balance.toString(),
    client_debt: balance.lt(0) ? balance.abs().toString() : "0"
  };
}

/** Mijozning yetkazilgan zakazlari uchun qoldiq — tanlash ro‘yxatini filtrlash. */
export async function listClientOrderPickBalances(
  tenantId: number,
  clientId: number
): Promise<import("./returns-enhanced.types").OrderReturnBalance[]> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      status: POLKI_SOURCE_ORDER_STATUS
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      items: {
        select: {
          product_id: true,
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { sku: true, name: true, unit: true, category_id: true } }
        }
      }
    }
  });
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const returns = await prisma.salesReturn.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      order_id: { in: orderIds },
      status: "posted"
    },
    select: {
      order_id: true,
      lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
    }
  });

  const out: import("./returns-enhanced.types").OrderReturnBalance[] = [];
  for (const order of orders) {
    const items: OrderItemSummary[] = order.items.map((item) => ({
      product_id: item.product_id,
      sku: item.product.sku,
      name: item.product.name,
      unit: item.product.unit,
      qty: item.qty.toString(),
      price: item.price.toString(),
      total: item.total.toString(),
      is_bonus: item.is_bonus,
      order_id: order.id,
      order_number: "",
      category_id: item.product.category_id
    }));
    const adjusted = adjustOrderItemsQtyAfterPriorReturns(items, returns);
    out.push(computeOrderReturnBalance(order.id, items, adjusted, returns));
  }
  return out;
}
